import type { PipelineRow } from "@/types/pipeline";
import { isPipelineTrackingCode } from "@/lib/entity-route-utils";
import { withPrismaRetry } from "@/lib/prisma";

/** Match opportunity/deal in live/JSON portfolio by id, PL- code, or name. */
export function findOpportunityInPortfolio(
  pipelines: PipelineRow[],
  routeKey: string,
): PipelineRow | undefined {
  const key = routeKey.trim();
  if (!key) return undefined;
  const lower = key.toLowerCase();

  return pipelines.find((pipeline) => {
    if (pipeline.id === key) return true;
    if (pipeline.assetName?.trim().toLowerCase() === lower) return true;
    return false;
  });
}

/**
 * Prisma lookup by opportunity id or name.
 * PL- codes live in the JSON seed store — Prisma uses UUIDs.
 * Never throws — returns null on miss / DB errors.
 */
export async function findPrismaOpportunityByRouteKey(routeKey: string) {
  const key = routeKey.trim();
  if (!key) return null;

  // Seed PL- ids are not Prisma UUIDs — skip DB for those codes
  if (isPipelineTrackingCode(key)) return null;

  try {
    return await withPrismaRetry((prisma) =>
      prisma.opportunity.findFirst({
        where: {
          OR: [
            { id: key },
            { name: { equals: key, mode: "insensitive" } },
          ],
        },
        include: { company: { select: { id: true, name: true } } },
      }),
    );
  } catch (error) {
    console.warn(
      "[resolve-opportunity-route] Prisma opportunity lookup failed:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

/**
 * Resolve deal/opportunity route: Prisma first (try/catch), then portfolio/JSON dual-store.
 */
export async function resolveOpportunityRouteRecord(
  pipelines: PipelineRow[],
  routeKey: string,
): Promise<PipelineRow | undefined> {
  const key = routeKey.trim();
  if (!key) return undefined;

  try {
    const prismaOpportunity = await findPrismaOpportunityByRouteKey(key);
    if (prismaOpportunity) {
      const fromLive =
        findOpportunityInPortfolio(pipelines, prismaOpportunity.id) ??
        findOpportunityInPortfolio(pipelines, prismaOpportunity.name);
      if (fromLive) return fromLive;
    }
  } catch (error) {
    console.warn(
      "[resolve-opportunity-route] Falling back to portfolio:",
      error instanceof Error ? error.message : error,
    );
  }

  return findOpportunityInPortfolio(pipelines, key);
}
