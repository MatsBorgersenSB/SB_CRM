import type { PipelineRow } from "@/types/pipeline";
import { isPipelineTrackingCode } from "@/lib/entity-route-utils";
import { withPrismaRetry } from "@/lib/prisma";
import { resolveEntity } from "@/lib/resolvers/entity-resolver";

/** Match opportunity/deal in portfolio — case-insensitive id / name. */
export function findOpportunityInPortfolio(
  pipelines: PipelineRow[],
  routeKey: string,
): PipelineRow | undefined {
  const key = routeKey.trim();
  if (!key) return undefined;
  const lower = key.toLowerCase();

  return pipelines.find((pipeline) => {
    if (pipeline.id.toLowerCase() === lower) return true;
    if (pipeline.assetName?.trim().toLowerCase() === lower) return true;
    return false;
  });
}

/** Prisma lookup — never throws. PL- seed codes skip DB (not UUIDs). */
export async function findPrismaOpportunityByRouteKey(routeKey: string) {
  const key = routeKey.trim();
  if (!key) return null;
  if (isPipelineTrackingCode(key)) return null;

  try {
    // Schema has no `code` field — match id (UUID) or name only
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
      "DB opportunity lookup bypassed:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

/** Resolve deal/opportunity: portfolio/seed first (PL-… / UUID), then Prisma. */
export async function resolveOpportunityRouteRecord(
  pipelines: PipelineRow[],
  routeKey: string,
): Promise<PipelineRow | undefined> {
  const key = routeKey.trim();
  if (!key) return undefined;

  const direct = findOpportunityInPortfolio(pipelines, key);
  if (direct) return direct;

  const record = await resolveEntity(
    key,
    async (searchKey) => {
      const prismaOpportunity = await findPrismaOpportunityByRouteKey(searchKey);
      if (!prismaOpportunity) return null;
      return (
        findOpportunityInPortfolio(pipelines, prismaOpportunity.id) ??
        findOpportunityInPortfolio(pipelines, prismaOpportunity.name) ??
        null
      );
    },
    pipelines as Array<PipelineRow & Record<string, unknown>>,
    {
      preferFallbackFirst: true,
      matchKeys: ["id", "assetName"],
    },
  );

  return record ?? undefined;
}
