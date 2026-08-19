import { getPrisma } from "@/lib/prisma";

/**
 * Resolve an Opportunity id from a "relation key" coming from UI fields.
 *
 * Why:
 * - Projects store `linkedDealId` and users can select project/opportunity using
 *   route keys/code/name.
 * - DocumentRecord.opportunityId is an FK, so we must never return a non-existent
 *   id (otherwise Prisma throws document_records_opportunityId_fkey).
 */
export async function resolveOpportunityRelationId(
  opportunityKey: string | null | undefined,
): Promise<string | null> {
  const key = opportunityKey?.trim();
  if (!key) return null;

  const prisma = getPrisma();

  // 1) Direct UUID / id
  const byId = await prisma.opportunity.findUnique({
    where: { id: key },
    select: { id: true },
  });
  if (byId) return byId.id;

  // 2) Public code (e.g. PL-1007) used in multiple SmartCRM UI contexts.
  const byCode = await prisma.opportunity.findFirst({
    where: { code: key },
    select: { id: true },
  });
  if (byCode) return byCode.id;

  // 3) Exact name match (fallback for stale demo labels / route keys).
  const byName = await prisma.opportunity.findFirst({
    where: { name: key },
    select: { id: true },
  });

  return byName?.id ?? null;
}

