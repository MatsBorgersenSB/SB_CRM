import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { getRequestRole } from "@/lib/api-auth";
import { canCreateCompany } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Mailbox providers that say nothing about the employer. */
const GENERIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "ymail.com",
  "outlook.com",
  "hotmail.com",
  "hotmail.co.uk",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "gmx.com",
  "gmx.net",
  "mail.com",
  "online.no",
  "telenor.no",
]);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type CardIntakeBody = {
  name?: unknown;
  role?: unknown;
  companyName?: unknown;
  email?: unknown;
  phone?: unknown;
};

type NormalizedCard = {
  name: string | null;
  role: string | null;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  phoneDigits: string | null;
};

type MatchReason =
  | "exact_email"
  | "phone_match"
  | "email_domain"
  | "company_name_exact"
  | "company_name_partial"
  | "full_name_match";

type ContactSummary = {
  id: string;
  fullName: string | null;
  jobTitle: string | null;
  companyId: string | null;
  companyName: string | null;
};

type CompanySummary = {
  id: string;
  name: string;
  website: string | null;
};

type ContactCandidate = {
  kind: "contact";
  confidence: number;
  reasons: MatchReason[];
  contact: ContactSummary;
};

type CompanyCandidate = {
  kind: "company";
  confidence: number;
  reasons: MatchReason[];
  company: CompanySummary;
};

type IntakeStatus = "existing_contact" | "candidates" | "no_match";

type IntakeResponse = {
  status: IntakeStatus;
  card: Omit<NormalizedCard, "phoneDigits">;
  emailDomain: string | null;
  emailDomainIsGeneric: boolean;
  existingContact: ContactSummary | null;
  contactCandidates: ContactCandidate[];
  companyCandidates: CompanyCandidate[];
  /** Quick-approval queue hint. The user decides; nothing is created here. */
  suggestedAction: "open_contact" | "review_candidates" | "classify_and_create_new";
};

type ContactRow = {
  id: string;
  fullName: string | null;
  jobTitle: string | null;
  companyId: string | null;
  companyName: string | null;
};

type CompanyRow = {
  id: string;
  name: string;
  website: string | null;
};

function asTrimmed(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeCard(body: CardIntakeBody): NormalizedCard {
  const phone = asTrimmed(body.phone);
  const digits = phone ? phone.replace(/\D/g, "") : "";
  return {
    name: asTrimmed(body.name),
    role: asTrimmed(body.role),
    companyName: asTrimmed(body.companyName),
    email: asTrimmed(body.email)?.toLowerCase() ?? null,
    phone,
    phoneDigits: digits.length >= 7 ? digits : null,
  };
}

function extractDomain(email: string | null): string | null {
  if (!email) return null;
  const at = email.lastIndexOf("@");
  if (at < 0) return null;
  const domain = email.slice(at + 1).trim().toLowerCase();
  return domain.length > 0 ? domain : null;
}

function normalizeCompanyName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .replace(/\b(as|asa|ab|oy|aps|ltd|limited|llc|inc|gmbh|plc|corp|co|sa|bv|nv)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clamp(score: number): number {
  return Math.round(Math.min(Math.max(score, 0), 1) * 100) / 100;
}

function toContactSummary(row: ContactRow): ContactSummary {
  return {
    id: row.id,
    fullName: row.fullName,
    jobTitle: row.jobTitle,
    companyId: row.companyId,
    companyName: row.companyName,
  };
}

/** Exact (case-insensitive) match against `Contact.emails[].address` (jsonb[]). */
async function findContactsByEmail(
  prisma: ReturnType<typeof getPrisma>,
  email: string,
): Promise<ContactRow[]> {
  return prisma.$queryRaw<ContactRow[]>(Prisma.sql`
    SELECT c.id, c."fullName", c."jobTitle", c."companyId", co.name AS "companyName"
    FROM contact_registry c
    LEFT JOIN company_registry co ON co.id = c."companyId"
    WHERE c.status <> 'archived'
      AND EXISTS (
        SELECT 1 FROM unnest(c.emails) AS e
        WHERE lower(e->>'address') = ${email}
      )
    LIMIT 5
  `);
}

/** Digits-only match against `Contact.phoneNumbers[].number`. */
async function findContactsByPhone(
  prisma: ReturnType<typeof getPrisma>,
  digits: string,
): Promise<ContactRow[]> {
  return prisma.$queryRaw<ContactRow[]>(Prisma.sql`
    SELECT c.id, c."fullName", c."jobTitle", c."companyId", co.name AS "companyName"
    FROM contact_registry c
    LEFT JOIN company_registry co ON co.id = c."companyId"
    WHERE c.status <> 'archived'
      AND EXISTS (
        SELECT 1 FROM unnest(c."phoneNumbers") AS p
        WHERE regexp_replace(coalesce(p->>'number', ''), '\\D', '', 'g') = ${digits}
      )
    LIMIT 5
  `);
}

/**
 * Companies whose website, company emails, or known contact emails share the
 * (non-generic) email domain.
 */
async function findCompaniesByDomain(
  prisma: ReturnType<typeof getPrisma>,
  domain: string,
): Promise<CompanyRow[]> {
  return prisma.$queryRaw<CompanyRow[]>(Prisma.sql`
    SELECT co.id, co.name, co.website
    FROM company_registry co
    WHERE co.status <> 'archived'
      AND (
        regexp_replace(
          lower(coalesce(co.website, '')),
          '^(https?://)?(www\\.)?([^/:?#]+).*$',
          '\\3'
        ) = ${domain}
        OR EXISTS (
          SELECT 1 FROM unnest(co.emails) AS e
          WHERE lower(split_part(e->>'address', '@', 2)) = ${domain}
        )
        OR EXISTS (
          SELECT 1
          FROM contact_registry k, unnest(k.emails) AS ke
          WHERE k."companyId" = co.id
            AND lower(split_part(ke->>'address', '@', 2)) = ${domain}
        )
      )
    LIMIT 5
  `);
}

async function findCompaniesByName(
  prisma: ReturnType<typeof getPrisma>,
  companyName: string,
): Promise<CompanySummary[]> {
  const normalized = normalizeCompanyName(companyName);
  const needle = normalized.length >= 3 ? normalized : companyName.toLowerCase();
  return prisma.company.findMany({
    where: {
      status: { not: "archived" },
      OR: [
        { name: { contains: needle, mode: "insensitive" } },
        { alternativeNames: { has: companyName } },
      ],
    },
    select: { id: true, name: true, website: true },
    take: 5,
  });
}

async function findContactsByFullName(
  prisma: ReturnType<typeof getPrisma>,
  name: string,
): Promise<ContactRow[]> {
  const rows = await prisma.contact.findMany({
    where: {
      status: { not: "archived" },
      fullName: { equals: name, mode: "insensitive" },
    },
    select: {
      id: true,
      fullName: true,
      jobTitle: true,
      companyId: true,
      company: { select: { name: true } },
    },
    take: 5,
  });
  return rows.map((row) => ({
    id: row.id,
    fullName: row.fullName,
    jobTitle: row.jobTitle,
    companyId: row.companyId,
    companyName: row.company?.name ?? null,
  }));
}

function scoreCompanyName(candidate: string, input: string): MatchReason | null {
  const a = normalizeCompanyName(candidate);
  const b = normalizeCompanyName(input);
  if (!a || !b) return null;
  if (a === b) return "company_name_exact";
  if (a.includes(b) || b.includes(a)) return "company_name_partial";
  return null;
}

function buildCompanyCandidates(
  card: NormalizedCard,
  domainMatches: CompanyRow[],
  nameMatches: CompanySummary[],
): CompanyCandidate[] {
  const byId = new Map<string, CompanyCandidate>();

  const upsert = (company: CompanySummary, reason: MatchReason, base: number) => {
    const existing = byId.get(company.id);
    if (!existing) {
      byId.set(company.id, {
        kind: "company",
        confidence: clamp(base),
        reasons: [reason],
        company,
      });
      return;
    }
    if (!existing.reasons.includes(reason)) existing.reasons.push(reason);
    // Independent signals reinforce: 1 - (1 - a)(1 - b)
    existing.confidence = clamp(1 - (1 - existing.confidence) * (1 - base));
  };

  for (const row of domainMatches) {
    upsert(row, "email_domain", 0.8);
  }
  for (const company of nameMatches) {
    const reason = card.companyName ? scoreCompanyName(company.name, card.companyName) : null;
    if (reason === "company_name_exact") upsert(company, reason, 0.7);
    else if (reason === "company_name_partial") upsert(company, reason, 0.4);
  }

  return [...byId.values()].sort((a, b) => b.confidence - a.confidence).slice(0, 5);
}

function buildContactCandidates(
  card: NormalizedCard,
  phoneMatches: ContactRow[],
  nameMatches: ContactRow[],
  companyIds: Set<string>,
): ContactCandidate[] {
  const byId = new Map<string, ContactCandidate>();

  const upsert = (row: ContactRow, reason: MatchReason, base: number) => {
    const existing = byId.get(row.id);
    if (!existing) {
      byId.set(row.id, {
        kind: "contact",
        confidence: clamp(base),
        reasons: [reason],
        contact: toContactSummary(row),
      });
      return;
    }
    if (!existing.reasons.includes(reason)) existing.reasons.push(reason);
    existing.confidence = clamp(1 - (1 - existing.confidence) * (1 - base));
  };

  for (const row of phoneMatches) upsert(row, "phone_match", 0.85);
  for (const row of nameMatches) {
    const sameCompany = row.companyId !== null && companyIds.has(row.companyId);
    upsert(row, "full_name_match", sameCompany ? 0.75 : 0.45);
  }

  // `card` retained for future signals (role similarity); no mutation here.
  void card;
  return [...byId.values()].sort((a, b) => b.confidence - a.confidence).slice(0, 5);
}

export async function POST(request: Request) {
  const role = getRequestRole(request);
  if (!canCreateCompany(role)) {
    return NextResponse.json(
      { error: "Insufficient role for business card intake" },
      { status: 403 },
    );
  }

  let body: CardIntakeBody;
  try {
    body = (await request.json()) as CardIntakeBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "JSON object body required" }, { status: 400 });
  }

  const card = normalizeCard(body);
  if (!card.name && !card.email) {
    return NextResponse.json(
      { error: "At least one of name or email is required" },
      { status: 400 },
    );
  }
  if (card.email && !EMAIL_PATTERN.test(card.email)) {
    return NextResponse.json({ error: "email is not a valid address" }, { status: 400 });
  }

  const domain = extractDomain(card.email);
  const domainIsGeneric = domain !== null && GENERIC_EMAIL_DOMAINS.has(domain);
  const publicCard = {
    name: card.name,
    role: card.role,
    companyName: card.companyName,
    email: card.email,
    phone: card.phone,
  };

  try {
    const prisma = getPrisma();

    // 1. Exact email match on Contact — authoritative.
    if (card.email) {
      const [existing] = await findContactsByEmail(prisma, card.email);
      if (existing) {
        const response: IntakeResponse = {
          status: "existing_contact",
          card: publicCard,
          emailDomain: domain,
          emailDomainIsGeneric: domainIsGeneric,
          existingContact: toContactSummary(existing),
          contactCandidates: [],
          companyCandidates: [],
          suggestedAction: "open_contact",
        };
        return NextResponse.json(response);
      }
    }

    // 2. Company lookup: corporate email domain, then card company name.
    const [domainMatches, nameMatches, phoneMatches, fullNameMatches] = await Promise.all([
      domain && !domainIsGeneric ? findCompaniesByDomain(prisma, domain) : Promise.resolve([]),
      card.companyName ? findCompaniesByName(prisma, card.companyName) : Promise.resolve([]),
      card.phoneDigits ? findContactsByPhone(prisma, card.phoneDigits) : Promise.resolve([]),
      card.name ? findContactsByFullName(prisma, card.name) : Promise.resolve([]),
    ]);

    const companyCandidates = buildCompanyCandidates(card, domainMatches, nameMatches);
    const contactCandidates = buildContactCandidates(
      card,
      phoneMatches,
      fullNameMatches,
      new Set(companyCandidates.map((c) => c.company.id)),
    );

    const hasCandidates = companyCandidates.length > 0 || contactCandidates.length > 0;
    const response: IntakeResponse = {
      status: hasCandidates ? "candidates" : "no_match",
      card: publicCard,
      emailDomain: domain,
      emailDomainIsGeneric: domainIsGeneric,
      existingContact: null,
      contactCandidates,
      companyCandidates,
      suggestedAction: hasCandidates ? "review_candidates" : "classify_and_create_new",
    };
    return NextResponse.json(response);
  } catch (error) {
    console.error("[crm/intake/card] failed", error);
    return NextResponse.json({ error: "Business card intake failed" }, { status: 500 });
  }
}
