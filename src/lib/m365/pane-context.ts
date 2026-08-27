import "server-only";

import type { Activity } from "@/types/activity";
import type { Company, Contact } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import { getActivitiesForCompany, isFollowUpOpen } from "@/lib/activity-utils";
import {
  EMPTY_CORRESPONDENCE,
  type CompanyCorrespondenceEvidence,
} from "@/lib/company-correspondence";
import { loadCorrespondenceEvidenceForCompany } from "@/lib/company-correspondence-data";
import { emailsIncludeAddress } from "@/lib/entity-route-utils";
import { emptyInventory } from "@/lib/inventory-data";
import { resolveCompanyFromInput, type M365DataContext } from "@/lib/m365/resolve-context";
import { withPrismaRetry } from "@/lib/prisma";
import { readActivities, readCompanies, readPipelines } from "@/lib/pipeline-db";
import {
  CONTACT_LIST_SELECT,
  OPPORTUNITY_LIST_SELECT,
  shouldFallbackToJsonPortfolio,
} from "@/lib/prisma-data";
import {
  mapPrismaCompanyToApp,
  mapPrismaOpportunityToPipelineRow,
  type PrismaContactListRow,
} from "@/lib/prisma-mappers";

/** Sidebar cards never need historical trees — 5 deals / activities / messages. */
export const M365_SIDEBAR_TAKE = 5;

const COMPANY_CARD_SELECT = {
  id: true,
  code: true,
  name: true,
  alternativeNames: true,
  organizationNumber: true,
  vatNumber: true,
  website: true,
  industry: true,
  sectors: true,
  size: true,
  types: true,
  companyType: true,
  status: true,
  ownerId: true,
  parentCompanyId: true,
  addressLine1: true,
  addressLine2: true,
  postalCode: true,
  city: true,
  stateRegion: true,
  country: true,
  countryCode: true,
  continent: true,
  emails: true,
  phoneNumbers: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type M365PaneResolved = {
  company: Company;
  contact?: Contact;
};

export type M365PaneLoadResult = {
  ctx: M365DataContext;
  resolved: M365PaneResolved | null;
  correspondence: CompanyCorrespondenceEvidence;
};

async function findContactIdByEmail(email: string): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) return null;

  try {
    const rows = await withPrismaRetry((prisma) =>
      prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM contact_registry
        WHERE status = 'active'
          AND EXISTS (
            SELECT 1
            FROM unnest(emails) AS e
            WHERE lower(e->>'address') = ${normalized}
          )
        LIMIT 1
      `,
    );
    if (rows[0]?.id) return rows[0].id;
  } catch {
    try {
      const rows = await withPrismaRetry((prisma) =>
        prisma.$queryRaw<Array<{ id: string }>>`
          SELECT id
          FROM contact_registry
          WHERE status = 'active'
            AND emails::text ILIKE ${"%" + normalized + "%"}
          LIMIT 1
        `,
      );
      if (rows[0]?.id) return rows[0].id;
    } catch {
      /* scanned emails below */
    }
  }

  const candidates = await withPrismaRetry((prisma) =>
    prisma.contact.findMany({
      where: { status: "active" },
      select: { id: true, emails: true },
    }),
  );
  return candidates.find((row) => emailsIncludeAddress(row.emails, normalized))?.id ?? null;
}

async function findPrismaCompanyId(routeKey: string): Promise<string | null> {
  const clean = routeKey.trim();
  if (!clean) return null;
  if (/^[0-9a-f-]{36}$/i.test(clean)) return clean;
  const row = await withPrismaRetry((prisma) =>
    prisma.company.findFirst({
      where: {
        OR: [{ code: clean }, { code: clean.toUpperCase() }],
      },
      select: { id: true },
    }),
  );
  return row?.id ?? null;
}

type CompanyCardRow = Awaited<ReturnType<typeof fetchCompanyCard>>;

async function fetchCompanyCard(prismaId: string, preferContactId?: string) {
  const row = await withPrismaRetry((prisma) =>
    prisma.company.findUnique({
      where: { id: prismaId },
      select: {
        ...COMPANY_CARD_SELECT,
        contacts: {
          where: { status: "active" },
          select: CONTACT_LIST_SELECT,
          take: M365_SIDEBAR_TAKE,
          orderBy: { updatedAt: "desc" },
        },
        opportunities: {
          where: { status: { in: ["open", "on_hold"] } },
          select: { id: true },
          take: M365_SIDEBAR_TAKE,
          orderBy: { updatedAt: "desc" },
        },
      },
    }),
  );
  if (!row) return null;
  if (!preferContactId || row.contacts.some((contact) => contact.id === preferContactId)) {
    return row;
  }
  const preferred = await withPrismaRetry((prisma) =>
    prisma.contact.findUnique({
      where: { id: preferContactId },
      select: CONTACT_LIST_SELECT,
    }),
  );
  if (!preferred) return row;
  return {
    ...row,
    contacts: [preferred, ...row.contacts].slice(0, M365_SIDEBAR_TAKE),
  };
}

function mapResolvedFromRow(row: NonNullable<CompanyCardRow>, email?: string): M365PaneResolved {
  const company = mapPrismaCompanyToApp({
    ...row,
    contacts: row.contacts as PrismaContactListRow[],
  });
  const normalized = email?.trim().toLowerCase();
  const contact = normalized
    ? company.contacts.find((entry) => entry.Email?.trim().toLowerCase() === normalized)
    : undefined;
  return contact ? { company, contact } : { company };
}

/**
 * Resolve one company (+ matching contact) without loading the portfolio.
 */
export async function resolveM365PaneCompany(input: {
  email?: string | null;
  companyId?: string | null;
}): Promise<M365PaneResolved | null> {
  const email = input.email?.trim().toLowerCase() || "";
  const companyId = input.companyId?.trim() || "";

  try {
    if (email) {
      const contactId = await findContactIdByEmail(email);
      if (contactId) {
        const contact = await withPrismaRetry((prisma) =>
          prisma.contact.findUnique({
            where: { id: contactId },
            select: { ...CONTACT_LIST_SELECT, companyId: true },
          }),
        );
        if (contact?.companyId) {
          const companyRow = await fetchCompanyCard(contact.companyId, contact.id);
          if (companyRow) return mapResolvedFromRow(companyRow, email);
        }
      }
    }

    if (companyId) {
      const prismaId = await findPrismaCompanyId(companyId);
      if (prismaId) {
        const companyRow = await fetchCompanyCard(prismaId);
        if (companyRow) return mapResolvedFromRow(companyRow, email || undefined);
      }
    }
  } catch (error) {
    if (!shouldFallbackToJsonPortfolio()) throw error;
  }

  if (!shouldFallbackToJsonPortfolio()) return null;

  const companies = await readCompanies();
  return resolveCompanyFromInput(
    companies,
    companyId ? { companyId } : { email },
  );
}

async function loadCompanyPipelines(company: Company): Promise<PipelineRow[]> {
  const prismaId = await findPrismaCompanyId(company.CompanyID).catch(() => null);
  if (prismaId) {
    const rows = await withPrismaRetry((prisma) =>
      prisma.opportunity.findMany({
        where: {
          companyId: prismaId,
          status: { in: ["open", "on_hold"] },
        },
        select: OPPORTUNITY_LIST_SELECT,
        orderBy: { updatedAt: "desc" },
        take: M365_SIDEBAR_TAKE,
      }),
    );
    return rows.map(mapPrismaOpportunityToPipelineRow);
  }

  return (await readPipelines())
    .filter((row) => company.pipelineIds.includes(row.id))
    .slice(0, M365_SIDEBAR_TAKE);
}

function pickSidebarActivities(activities: Activity[], company: Company): Activity[] {
  const scoped = getActivitiesForCompany(activities, company);
  const open = scoped.filter(isFollowUpOpen);
  const rest = scoped.filter((activity) => !open.includes(activity));
  return [...open, ...rest].slice(0, M365_SIDEBAR_TAKE);
}

/**
 * Lightweight M365 context for Outlook / Teams sidebars.
 * One company, take:5 deals / activities / correspondence — never the full registry.
 */
export async function loadM365PaneContext(input: {
  email?: string | null;
  companyId?: string | null;
}): Promise<M365PaneLoadResult> {
  const resolved = await resolveM365PaneCompany(input);
  if (!resolved) {
    return {
      ctx: {
        companies: [],
        pipelines: [],
        activities: [],
        inventory: emptyInventory,
      },
      resolved: null,
      correspondence: EMPTY_CORRESPONDENCE,
    };
  }

  const [pipelines, jsonActivities, correspondence] = await Promise.all([
    loadCompanyPipelines(resolved.company).catch(() => [] as PipelineRow[]),
    readActivities().catch(() => [] as Activity[]),
    loadCorrespondenceEvidenceForCompany(resolved.company, {
      take: M365_SIDEBAR_TAKE,
    }).catch(() => EMPTY_CORRESPONDENCE),
  ]);

  return {
    ctx: {
      companies: [resolved.company],
      pipelines,
      activities: pickSidebarActivities(jsonActivities, resolved.company),
      inventory: emptyInventory,
    },
    resolved,
    correspondence,
  };
}
