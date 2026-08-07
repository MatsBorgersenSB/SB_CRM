import type { PipelineRow } from "@/types/pipeline";
import { mapPrismaOpportunityToPipelineRow } from "@/lib/prisma-mappers";
import { isPipelineTrackingCode } from "@/lib/entity-route-utils";
import { withPrismaRetry } from "@/lib/prisma";
import { resolveEntity } from "@/lib/resolvers/entity-resolver";

/** Match opportunity/deal in portfolio — id, public code, or name. */
export function findOpportunityInPortfolio(
  pipelines: PipelineRow[],
  routeKey: string,
): PipelineRow | undefined {
  const key = routeKey.trim();
  if (!key) return undefined;
  const lower = key.toLowerCase();

  return pipelines.find((pipeline) => {
    if (pipeline.id.toLowerCase() === lower) return true;
    if (pipeline.code?.trim().toLowerCase() === lower) return true;
    if (pipeline.assetName?.trim().toLowerCase() === lower) return true;
    return false;
  });
}

/** Prisma lookup by UUID id, public PL code, or name — never throws. */
export async function findPrismaOpportunityByRouteKey(routeKey: string) {
  const key = routeKey.trim();
  if (!key) return null;

  try {
    return await withPrismaRetry((prisma) =>
      prisma.opportunity.findFirst({
        where: {
          OR: [
            { id: key },
            { code: key },
            { code: key.toUpperCase() },
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
      const mapped = mapPrismaOpportunityToPipelineRow(prismaOpportunity);
      return (
        findOpportunityInPortfolio(pipelines, mapped.id) ??
        findOpportunityInPortfolio(pipelines, mapped.code ?? "") ??
        findOpportunityInPortfolio(pipelines, mapped.assetName) ??
        mapped
      );
    },
    pipelines as Array<PipelineRow & Record<string, unknown>>,
    {
      preferFallbackFirst: isPipelineTrackingCode(key),
      matchKeys: ["id", "code", "assetName"],
    },
  );

  return record ?? undefined;
}
