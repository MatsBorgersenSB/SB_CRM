import type { Company } from "@/lib/companies-data";
import {
  findContactByContactId,
  getGlobalContactRecords,
  getLinkedPipelineIdsForContact,
  type GlobalContactRecord,
} from "@/lib/contact-utils";
import {
  contactTrackingMatches,
  emailsIncludeAddress,
  isContactTrackingCode,
} from "@/lib/entity-route-utils";
import { withPrismaRetry } from "@/lib/prisma";
import {
  mapPrismaContactToApp,
  stableNumericId,
  toContactTrackingId,
} from "@/lib/prisma-mappers";
import { resolveEntity } from "@/lib/resolvers/entity-resolver";
import type { PipelineRow } from "@/types/pipeline";
import type { ContactListRole, RelationshipLevel } from "@/types/contact";
import type { EmploymentStatus } from "@/types/contact-lifecycle";

/**
 * Prisma lookup — valid Contact fields only (no scalar `email` / `code`).
 * Never throws.
 */
export async function findPrismaContactByIdOrEmail(routeKey: string) {
  const key = routeKey.trim();
  if (!key) return null;

  try {
    const byId = await withPrismaRetry((prisma) =>
      prisma.contact.findFirst({
        where: {
          OR: [
            { id: key },
            { m365GraphId: key },
            { m365ImmutableId: key },
            { fullName: { equals: key, mode: "insensitive" } },
          ],
        },
        include: { company: true },
      }),
    );
    if (byId) return byId;

    if (key.includes("@")) {
      const candidates = await withPrismaRetry((client) =>
        client.contact.findMany({
          where: { status: "active" },
          include: { company: true },
        }),
      );
      return (
        candidates.find((row) => emailsIncludeAddress(row.emails, key)) ?? null
      );
    }

    if (isContactTrackingCode(key)) {
      const candidates = await withPrismaRetry((client) =>
        client.contact.findMany({
          where: { status: { in: ["active", "archived"] } },
          include: { company: true },
        }),
      );
      return (
        candidates.find((row) => contactTrackingMatches(row.id, key)) ?? null
      );
    }

    return null;
  } catch (error) {
    console.warn(
      "[resolve-contact-route] DB contact lookup bypassed:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

function parseContactMeta(personalNotes: string | null | undefined): {
  role?: string;
  relationshipLevel?: string;
  employmentStatus?: string;
} {
  if (!personalNotes?.trim()) return {};
  try {
    const parsed = JSON.parse(personalNotes) as {
      role?: string;
      relationshipLevel?: string;
      employmentStatus?: string;
    };
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    // plain-text notes
  }
  return {};
}

/**
 * Build a list/detail GlobalContactRecord from Prisma even when the contact is
 * missing from the in-memory portfolio (JSON fallback / stale SSR).
 */
async function hydrateGlobalContactFromPrisma(
  prismaContactId: string,
  pipelines: PipelineRow[],
): Promise<GlobalContactRecord | null> {
  try {
    const { loadMappedPrismaCompany } = await import("@/lib/company-registry");

    const row = await withPrismaRetry((prisma) =>
      prisma.contact.findUnique({
        where: { id: prismaContactId },
        include: {
          company: {
            include: {
              contacts: { where: { status: "active" } },
              opportunities: { select: { id: true } },
              parentCompany: { select: { id: true, name: true } },
            },
          },
        },
      }),
    );
    if (!row?.companyId) return null;

    const company =
      row.company != null
        ? await loadMappedPrismaCompany(row.companyId)
        : null;
    if (!company) return null;

    const companyLookup = {
      Id: stableNumericId(row.companyId),
      Title: company.Title,
    };
    const mapped = mapPrismaContactToApp(row, companyLookup);
    const meta = parseContactMeta(row.personalNotes);
    const contact = {
      ...mapped,
      Role: (meta.role as ContactListRole) || mapped.Role,
      RelationshipLevel:
        (meta.relationshipLevel as RelationshipLevel) || mapped.RelationshipLevel,
      EmploymentStatus:
        (meta.employmentStatus as EmploymentStatus) ||
        mapped.EmploymentStatus ||
        "Active",
      ContactID: toContactTrackingId(row.id),
    };

    // Ensure the hydrated company carries this contact for shell lookups.
    if (!company.contacts.some((entry) => entry.ContactID === contact.ContactID)) {
      company.contacts = [...company.contacts, contact];
    }

    return {
      contact,
      companyId: company.CompanyID,
      companyName: company.Title,
      linkedPipelineIds: getLinkedPipelineIdsForContact(
        contact.ContactID,
        company,
        pipelines,
      ),
    };
  } catch (error) {
    console.warn(
      "[resolve-contact-route] Prisma contact hydrate failed:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

/**
 * Resolve contact: portfolio/seed first (CT-… links), then Prisma hydrate
 * (same durability as company detail — not dependent on list portfolio).
 */
export async function resolveContactRouteRecord(
  companies: Company[],
  pipelines: PipelineRow[],
  routeKey: string,
  companyHint?: string,
): Promise<GlobalContactRecord | undefined> {
  const key = routeKey.trim();
  if (!key) return undefined;

  const direct = findContactByContactId(companies, pipelines, key, companyHint);
  if (direct) return direct;

  const prismaContact = await findPrismaContactByIdOrEmail(key);
  if (prismaContact) {
    const trackingId = toContactTrackingId(prismaContact.id);
    const fromPortfolio =
      findContactByContactId(companies, pipelines, trackingId, companyHint) ??
      findContactByContactId(companies, pipelines, trackingId);
    if (fromPortfolio) return fromPortfolio;

    const hydrated = await hydrateGlobalContactFromPrisma(prismaContact.id, pipelines);
    if (hydrated) return hydrated;
  }

  const fallback = getGlobalContactRecords(companies, pipelines);
  const record = await resolveEntity(
    key,
    async () => null,
    fallback as Array<GlobalContactRecord & Record<string, unknown>>,
    {
      preferFallbackFirst: true,
      matchKeys: ["companyId", "companyName"],
      getMatchValues: (row) => [
        row.contact.ContactID,
        row.contact.id,
        String(row.contact.id),
        row.contact.Email,
        row.contact.Title,
        `${row.contact.FirstName} ${row.contact.LastName}`.trim(),
      ],
    },
  );

  return record ?? undefined;
}
