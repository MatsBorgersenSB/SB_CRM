/**
 * Universal Data Deduplication & Guardrail Engine
 * Reality First: never invent matches — only report what the registry holds.
 */

import "server-only";

import { withPrismaRetry } from "@/lib/prisma";
import { emailsIncludeAddress } from "@/lib/entity-route-utils";
import { toCompanyTrackingId, toContactTrackingId } from "@/lib/prisma-mappers";
import type {
  CompanyDuplicateCheckResult,
  ContactDuplicateCheckResult,
  DedupCompanySummary,
  DedupContactSummary,
  DedupOpportunitySummary,
  DedupProjectSummary,
  OpportunityDuplicateCheckResult,
  ProjectDuplicateCheckResult,
} from "@/lib/validation/deduplication-types";

export type {
  CompanyDuplicateCheckResult,
  ContactDuplicateCheckResult,
  DedupCompanySummary,
  DedupContactSummary,
  DedupOpportunitySummary,
  DedupProjectSummary,
  OpportunityDuplicateCheckResult,
  ProjectDuplicateCheckResult,
} from "@/lib/validation/deduplication-types";

function normalizeNamePart(value: string | undefined | null): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeOrgNumber(value: string | undefined | null): string {
  return (value ?? "").replace(/[\s\-./]/g, "").toUpperCase();
}

function normalizeCompanyName(value: string | undefined | null): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,]/g, "");
}

function primaryEmailFromJson(emails: unknown): string {
  if (!Array.isArray(emails) || emails.length === 0) return "";
  const primary = emails.find(
    (entry) =>
      entry &&
      typeof entry === "object" &&
      "isPrimary" in entry &&
      (entry as { isPrimary?: boolean }).isPrimary,
  );
  const pick = (primary ?? emails[0]) as { address?: string };
  return typeof pick.address === "string" ? pick.address.trim() : "";
}

function mapContactSummary(row: {
  id: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  jobTitle: string | null;
  emails: unknown;
  companyId: string | null;
  company: { id: string; name: string; code: string | null } | null;
}): DedupContactSummary {
  return {
    id: row.id,
    contactId: toContactTrackingId(row.id),
    firstName: row.firstName?.trim() || "",
    lastName: row.lastName?.trim() || "",
    fullName:
      row.fullName?.trim() ||
      `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim() ||
      "Unknown contact",
    email: primaryEmailFromJson(row.emails),
    jobTitle: row.jobTitle?.trim() || "",
    companyId: row.company
      ? row.company.code?.trim() || toCompanyTrackingId(row.company.id)
      : null,
    companyName: row.company?.name ?? "—",
  };
}

export async function checkContactDuplicate(input: {
  firstName?: string;
  lastName?: string;
  email?: string;
  companyId?: string;
}): Promise<ContactDuplicateCheckResult> {
  const email = (input.email ?? "").trim().toLowerCase();
  const firstName = normalizeNamePart(input.firstName);
  const lastName = normalizeNamePart(input.lastName);

  const include = {
    company: { select: { id: true, name: true, code: true } },
  } as const;

  if (email) {
    const candidates = await withPrismaRetry((prisma) =>
      prisma.contact.findMany({
        where: { status: { in: ["active", "archived"] } },
        include,
        take: 500,
      }),
    );
    const emailMatch = candidates.find((row) =>
      emailsIncludeAddress(row.emails, email),
    );
    if (emailMatch) {
      return {
        status: "EXACT_EMAIL_EXISTS",
        existingContact: mapContactSummary(emailMatch),
      };
    }
  }

  if (!firstName || !lastName) {
    return { status: "CLEAN" };
  }

  const nameCandidates = await withPrismaRetry((prisma) =>
    prisma.contact.findMany({
      where: {
        status: { in: ["active", "archived"] },
        firstName: { equals: input.firstName!.trim(), mode: "insensitive" },
        lastName: { equals: input.lastName!.trim(), mode: "insensitive" },
      },
      include,
      take: 25,
    }),
  );

  const matches = nameCandidates.filter((row) => {
    const rowFirst = normalizeNamePart(row.firstName);
    const rowLast = normalizeNamePart(row.lastName);
    return rowFirst === firstName && rowLast === lastName;
  });

  if (matches.length === 0) {
    return { status: "CLEAN" };
  }

  return {
    status: "NAME_SIMILARITY_MATCH",
    existingContacts: matches.map(mapContactSummary),
  };
}

export async function checkCompanyDuplicate(input: {
  name?: string;
  orgNumber?: string;
}): Promise<CompanyDuplicateCheckResult> {
  const orgNumber = normalizeOrgNumber(input.orgNumber);
  const name = normalizeCompanyName(input.name);

  if (orgNumber) {
    const byOrg = await withPrismaRetry((prisma) =>
      prisma.company.findFirst({
        where: {
          OR: [
            { organizationNumber: { equals: input.orgNumber!.trim(), mode: "insensitive" } },
            { organizationNumber: orgNumber },
          ],
        },
        select: {
          id: true,
          name: true,
          code: true,
          organizationNumber: true,
        },
      }),
    );
    if (byOrg) {
      return {
        status: "DUPLICATE_EXISTS",
        existingCompany: {
          id: byOrg.id,
          companyId: byOrg.code?.trim() || toCompanyTrackingId(byOrg.id),
          name: byOrg.name,
          organizationNumber: byOrg.organizationNumber,
        },
      };
    }
  }

  if (!name) {
    return { status: "CLEAN" };
  }

  const byName = await withPrismaRetry((prisma) =>
    prisma.company.findFirst({
      where: {
        name: { equals: input.name!.trim(), mode: "insensitive" },
        status: { in: ["active", "archived"] },
      },
      select: {
        id: true,
        name: true,
        code: true,
        organizationNumber: true,
      },
    }),
  );

  if (byName && normalizeCompanyName(byName.name) === name) {
    return {
      status: "DUPLICATE_EXISTS",
      existingCompany: {
        id: byName.id,
        companyId: byName.code?.trim() || toCompanyTrackingId(byName.id),
        name: byName.name,
        organizationNumber: byName.organizationNumber,
      },
    };
  }

  return { status: "CLEAN" };
}

export async function checkProjectDuplicate(input: {
  title?: string;
}): Promise<ProjectDuplicateCheckResult> {
  const title = (input.title ?? "").trim();
  if (!title) return { status: "CLEAN" };

  const existing = await withPrismaRetry((prisma) =>
    prisma.project.findFirst({
      where: { title: { equals: title, mode: "insensitive" } },
      select: {
        id: true,
        title: true,
        projectType: true,
        companyId: true,
      },
    }),
  );

  if (!existing) return { status: "CLEAN" };

  return {
    status: "DUPLICATE_TITLE",
    existingProject: {
      id: existing.id,
      title: existing.title,
      projectType: existing.projectType,
      companyId: existing.companyId,
    } satisfies DedupProjectSummary,
  };
}

export async function checkOpportunityDuplicate(input: {
  title?: string;
  companyId?: string;
}): Promise<OpportunityDuplicateCheckResult> {
  const title = (input.title ?? "").trim();
  const companyId = (input.companyId ?? "").trim();
  if (!title || !companyId) return { status: "CLEAN" };

  const existing = await withPrismaRetry((prisma) =>
    prisma.opportunity.findFirst({
      where: {
        companyId,
        name: { equals: title, mode: "insensitive" },
        status: { in: ["open", "on_hold"] },
      },
      include: { company: { select: { id: true, name: true } } },
    }),
  );

  if (!existing) return { status: "CLEAN" };

  return {
    status: "DUPLICATE_EXISTS",
    existingOpportunity: {
      id: existing.id,
      name: existing.name,
      companyId: existing.companyId,
      companyName: existing.company?.name ?? "—",
    } satisfies DedupOpportunitySummary,
  };
}
