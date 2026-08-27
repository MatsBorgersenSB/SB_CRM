/**
 * Markers for the former Prisma demo seed (Acme Renewables, Global TechCorp, …).
 * Reality First: these are invented records and must never appear as live relationships.
 *
 * A real company named Standard Bio is not matched — only the seed copy owned by
 * `DEMO_SEED_OWNER_ID`.
 */
export const DEMO_SEED_OWNER_ID = "seed-owner-commercial-01";

export const DEMO_SEED_COMPANY_NAMES = ["Acme Renewables", "Global TechCorp"] as const;

export const DEMO_SEED_WORKFLOW_RULE_NAMES = [
  "High Churn Risk Mitigation",
  "Post-Meeting Follow-up Auto-Draft",
] as const;

/** Prisma `where` matching invented seed companies only. */
export const prismaDemoSeedCompanyWhere = {
  OR: [
    { ownerId: DEMO_SEED_OWNER_ID },
    { name: { in: [...DEMO_SEED_COMPANY_NAMES] } },
    { website: { contains: ".example" } },
  ],
};

/** Prisma `where` matching invented seed opportunities. */
export const prismaDemoSeedOpportunityWhere = {
  OR: [
    { ownerId: DEMO_SEED_OWNER_ID },
    { company: prismaDemoSeedCompanyWhere },
  ],
};

export function isDemoSeedCompanyRow(row: {
  ownerId?: string | null;
  name?: string | null;
  website?: string | null;
}): boolean {
  if (row.ownerId === DEMO_SEED_OWNER_ID) return true;
  if (
    row.name &&
    (DEMO_SEED_COMPANY_NAMES as readonly string[]).includes(row.name)
  ) {
    return true;
  }
  return Boolean(row.website?.includes(".example"));
}
