import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { getRequestRole } from "@/lib/api-auth";
import { canCreateCompany } from "@/lib/permissions";
import { allocateNextCompanyCode } from "@/lib/data/companies";
import { normalizePhoneNumber } from "@/lib/m365/phone-normalization";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ACTIONS = [
  "attach_to_company",
  "create_company_and_contact",
  "attach_contact_only",
] as const;

type ApproveAction = (typeof ACTIONS)[number];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_URL_LENGTH = 2048;

type ApproveBody = {
  action?: unknown;
  companyId?: unknown;
  contact?: {
    name?: unknown;
    role?: unknown;
    email?: unknown;
    phone?: unknown;
    companyName?: unknown;
  } | null;
  evidenceUrl?: unknown;
};

type ParsedContact = {
  name: string;
  firstName: string | null;
  lastName: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  companyName: string | null;
};

type ApproveResult = {
  action: ApproveAction;
  contactId: string;
  companyId: string | null;
  companyCode: string | null;
  companyCreated: boolean;
};

/** Business-rule failure raised inside the transaction (rolls it back). */
class ApproveError extends Error {
  constructor(
    readonly status: 400 | 404 | 409,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApproveError";
  }
}

function asTrimmed(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function splitName(name: string): { firstName: string | null; lastName: string | null } {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: null, lastName: null };
  if (parts.length === 1) return { firstName: parts[0]!, lastName: null };
  return { firstName: parts[0]!, lastName: parts.slice(1).join(" ") };
}

function parseEvidenceUrl(value: unknown): string | null | "invalid" {
  if (value === undefined || value === null || value === "") return null;
  const raw = asTrimmed(value);
  if (!raw || raw.length > MAX_URL_LENGTH) return "invalid";
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "invalid";
  } catch {
    return "invalid";
  }
}

function parseContact(raw: ApproveBody["contact"]): ParsedContact | string {
  if (!raw || typeof raw !== "object") return "contact object is required";
  const name = asTrimmed(raw.name);
  if (!name) return "contact.name is required";

  const email = asTrimmed(raw.email)?.toLowerCase() ?? null;
  if (email && !EMAIL_PATTERN.test(email)) return "contact.email is not a valid address";

  const rawPhone = asTrimmed(raw.phone);
  const phone = rawPhone ? normalizePhoneNumber(rawPhone) || null : null;

  return {
    name,
    ...splitName(name),
    role: asTrimmed(raw.role),
    email,
    phone,
    companyName: asTrimmed(raw.companyName),
  };
}

/** Case-insensitive exact match on `Contact.emails[].address` (jsonb[]). */
async function findContactIdByEmail(
  tx: Prisma.TransactionClient,
  email: string,
): Promise<string | null> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT c.id
    FROM contact_registry c
    WHERE c.status <> 'archived'
      AND EXISTS (
        SELECT 1 FROM unnest(c.emails) AS e
        WHERE lower(e->>'address') = ${email}
      )
    LIMIT 1
  `);
  return rows[0]?.id ?? null;
}

function buildContactData(
  contact: ParsedContact,
  companyId: string | null,
  ownerId: string | null,
  evidenceUrl: string | null,
): Prisma.ContactUncheckedCreateInput {
  return {
    firstName: contact.firstName,
    lastName: contact.lastName,
    fullName: contact.name,
    jobTitle: contact.role,
    status: "active",
    companyId,
    ownerId,
    emails: contact.email ? [{ address: contact.email, type: "work", isPrimary: true }] : [],
    phoneNumbers: contact.phone
      ? [{ number: contact.phone, type: "mobile", isPrimary: true }]
      : [],
    backgroundNotes: evidenceUrl ? `Added from business card. Evidence: ${evidenceUrl}` : null,
  };
}

async function runApproval(
  prisma: ReturnType<typeof getPrisma>,
  params: {
    action: ApproveAction;
    companyId: string | null;
    contact: ParsedContact;
    evidenceUrl: string | null;
    ownerId: string | null;
    authorId: string;
  },
): Promise<ApproveResult> {
  const { action, contact, evidenceUrl, ownerId, authorId } = params;

  return prisma.$transaction(
    async (tx) => {
      // Never create a duplicate person: exact email is authoritative.
      if (contact.email) {
        const existingContactId = await findContactIdByEmail(tx, contact.email);
        if (existingContactId) {
          throw new ApproveError(409, "A contact with this email already exists", {
            existingContactId,
          });
        }
      }

      if (action === "attach_contact_only") {
        const created = await tx.contact.create({
          data: buildContactData(contact, null, ownerId, evidenceUrl),
          select: { id: true },
        });
        return {
          action,
          contactId: created.id,
          companyId: null,
          companyCode: null,
          companyCreated: false,
        };
      }

      if (action === "attach_to_company") {
        const company = await tx.company.findFirst({
          where: { id: params.companyId!, status: { not: "archived" } },
          select: { id: true, code: true },
        });
        if (!company) throw new ApproveError(404, "Company not found");

        const created = await tx.contact.create({
          data: buildContactData(contact, company.id, ownerId, evidenceUrl),
          select: { id: true },
        });
        return {
          action,
          contactId: created.id,
          companyId: company.id,
          companyCode: company.code,
          companyCreated: false,
        };
      }

      // create_company_and_contact
      const companyName = contact.companyName!;
      const duplicate = await tx.company.findFirst({
        where: {
          status: { not: "archived" },
          OR: [
            { name: { equals: companyName, mode: "insensitive" } },
            { alternativeNames: { has: companyName } },
          ],
        },
        select: { id: true, name: true },
      });
      if (duplicate) {
        throw new ApproveError(
          409,
          `A company named "${duplicate.name}" already exists. Attach to it instead.`,
          { existingCompanyId: duplicate.id },
        );
      }

      const code = await allocateNextCompanyCode(tx);
      // Reality First: the relationship role is the user's call — never default to Customer.
      const company = await tx.company.create({
        data: {
          code,
          name: companyName,
          types: ["Unclassified"],
          companyType: "Unclassified",
          status: "active",
          size: "unknown",
          ownerId,
        },
        select: { id: true, code: true },
      });

      await tx.companyNote.create({
        data: {
          companyId: company.id,
          authorId,
          content: evidenceUrl
            ? `Created from a business card for ${contact.name}. Evidence: ${evidenceUrl}`
            : `Created from a business card for ${contact.name}.`,
        },
      });

      const created = await tx.contact.create({
        data: buildContactData(contact, company.id, ownerId, evidenceUrl),
        select: { id: true },
      });

      return {
        action,
        contactId: created.id,
        companyId: company.id,
        companyCode: company.code,
        companyCreated: true,
      };
    },
    { maxWait: 5_000, timeout: 15_000 },
  );
}

export async function POST(request: Request) {
  const role = getRequestRole(request);
  if (!canCreateCompany(role)) {
    return NextResponse.json(
      { error: "Insufficient role to approve business card intake" },
      { status: 403 },
    );
  }

  let body: ApproveBody;
  try {
    body = (await request.json()) as ApproveBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "JSON object body required" }, { status: 400 });
  }

  const action = ACTIONS.find((a) => a === body.action);
  if (!action) {
    return NextResponse.json(
      { error: `action must be one of: ${ACTIONS.join(", ")}` },
      { status: 400 },
    );
  }

  const parsedContact = parseContact(body.contact);
  if (typeof parsedContact === "string") {
    return NextResponse.json({ error: parsedContact }, { status: 400 });
  }

  const evidenceUrl = parseEvidenceUrl(body.evidenceUrl);
  if (evidenceUrl === "invalid") {
    return NextResponse.json(
      { error: "evidenceUrl must be a valid http(s) URL" },
      { status: 400 },
    );
  }

  const companyId = asTrimmed(body.companyId);
  if (action === "attach_to_company" && !companyId) {
    return NextResponse.json(
      { error: "companyId is required for attach_to_company" },
      { status: 400 },
    );
  }
  if (action === "create_company_and_contact" && !parsedContact.companyName) {
    return NextResponse.json(
      { error: "contact.companyName is required for create_company_and_contact" },
      { status: 400 },
    );
  }

  const userId = request.headers.get("x-sb-user-id")?.trim() || null;

  try {
    const result = await runApproval(getPrisma(), {
      action,
      companyId,
      contact: parsedContact,
      evidenceUrl,
      ownerId: userId,
      authorId: userId ?? `role:${role}`,
    });
    return NextResponse.json({ status: "created", ...result }, { status: 201 });
  } catch (error) {
    if (error instanceof ApproveError) {
      return NextResponse.json(
        { error: error.message, ...error.details },
        { status: error.status },
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "A conflicting record was created concurrently. Retry." },
        { status: 409 },
      );
    }
    console.error("[crm/intake/card/approve] failed", error);
    return NextResponse.json({ error: "Business card approval failed" }, { status: 500 });
  }
}
