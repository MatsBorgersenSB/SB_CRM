/**
 * Markers for the former Prisma demo seed (Acme Renewables, Global TechCorp, …).
 * Reality First: these are invented records and must never appear as live relationships.
 *
 * A real company named Standard Bio is not matched — only the seed copy owned by
 * `DEMO_SEED_OWNER_ID`.
 *
 * IMPORTANT — SQL NULL semantics:
 * `NOT: { OR: [{ ownerId: seed }, …] }` drops rows where nullable fields are NULL,
 * because `NOT UNKNOWN` is UNKNOWN. Live queries must use the `prismaLive*Where`
 * helpers below. Keep `prismaDemoSeed*Where` for positive matches (purge/delete only).
 */
export const DEMO_SEED_OWNER_ID = "seed-owner-commercial-01";

export const DEMO_SEED_COMPANY_NAMES = ["Acme Renewables", "Global TechCorp"] as const;

export const DEMO_SEED_WORKFLOW_RULE_NAMES = [
  "High Churn Risk Mitigation",
  "Post-Meeting Follow-up Auto-Draft",
] as const;

/** Positive match — invented seed companies only (purge / deleteMany). */
export const prismaDemoSeedCompanyWhere = {
  OR: [
    { ownerId: DEMO_SEED_OWNER_ID },
    { name: { in: [...DEMO_SEED_COMPANY_NAMES] } },
    { website: { contains: ".example" } },
  ],
};

/** Positive match — invented seed opportunities (purge / deleteMany). */
export const prismaDemoSeedOpportunityWhere = {
  OR: [
    { ownerId: DEMO_SEED_OWNER_ID },
    { company: prismaDemoSeedCompanyWhere },
  ],
};

/**
 * NULL-safe live company filter — keep real rows; exclude seed markers only.
 * Prefer this over `NOT: prismaDemoSeedCompanyWhere`.
 */
export const prismaLiveCompanyWhere = {
  AND: [
    {
      OR: [{ ownerId: null }, { ownerId: { not: DEMO_SEED_OWNER_ID } }],
    },
    { name: { notIn: [...DEMO_SEED_COMPANY_NAMES] } },
    {
      OR: [
        { website: null },
        { NOT: { website: { contains: ".example" } } },
      ],
    },
  ],
};

/**
 * NULL-safe live opportunity filter — Opportunity.ownerId is required, so a
 * simple `not` is enough; company uses the live company filter.
 */
export const prismaLiveOpportunityWhere = {
  AND: [
    { ownerId: { not: DEMO_SEED_OWNER_ID } },
    { company: prismaLiveCompanyWhere },
  ],
};

/**
 * NULL-safe live contact filter — most real contacts have null ownerId /
 * m365GraphId; those must remain visible.
 */
export const prismaLiveContactWhere = {
  AND: [
    {
      OR: [{ ownerId: null }, { ownerId: { not: DEMO_SEED_OWNER_ID } }],
    },
    {
      OR: [
        { m365GraphId: null },
        { NOT: { m365GraphId: { startsWith: "seed-m365-" } } },
      ],
    },
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
