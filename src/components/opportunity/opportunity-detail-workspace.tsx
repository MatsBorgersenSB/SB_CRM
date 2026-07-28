import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Deal360PageShell } from "@/components/layout/deal-360-page-shell";
import { normalizeEntityParam } from "@/lib/resolvers/entity-resolver";
import {
  readLiveActivities,
  readLiveCommercialPackages,
  readLivePortfolio,
} from "@/lib/prisma-data";
import {
  findOpportunityInPortfolio,
  findPrismaOpportunityByRouteKey,
  resolveOpportunityRouteRecord,
} from "@/lib/resolve-opportunity-route";
import { mapPrismaOpportunityToPipelineRow } from "@/lib/prisma-mappers";

type OpportunityRouteParams = {
  id?: string;
  dealId?: string;
  opportunityId?: string;
};

/**
 * Shared Opportunity / Deal 360 loader.
 * Pattern: normalize param → Prisma (try/catch) → portfolio/seed → notFound().
 */
export async function OpportunityDetailWorkspace({
  params,
  paramKeys = ["id", "dealId", "opportunityId"],
}: {
  params: Promise<OpportunityRouteParams>;
  paramKeys?: Array<keyof OpportunityRouteParams>;
}) {
  const resolvedParams = await params;

  let rawKey = "";
  for (const key of paramKeys) {
    const value = resolvedParams[key];
    if (value) {
      rawKey = normalizeEntityParam(value);
      if (rawKey) break;
    }
  }

  // Mirror: id || dealId, decode, strip query, trim (case kept for UUID / PL- codes)
  const cleanKey = rawKey.toLowerCase();

  if (!rawKey) {
    notFound();
  }

  const [{ companies, pipelines }, activities, commercialPackages] =
    await Promise.all([
      readLivePortfolio(),
      readLiveActivities(),
      readLiveCommercialPackages(),
    ]);

  // 1. Portfolio / seed first (PL-1042 links from the opportunities list)
  let opportunity =
    findOpportunityInPortfolio(pipelines, rawKey) ??
    findOpportunityInPortfolio(pipelines, cleanKey) ??
    null;

  // 2. Prisma bridge (no `code` field on Opportunity — id + name only)
  if (!opportunity) {
    try {
      const prismaRow = await findPrismaOpportunityByRouteKey(rawKey);
      if (prismaRow) {
        opportunity =
          findOpportunityInPortfolio(pipelines, prismaRow.id) ??
          findOpportunityInPortfolio(pipelines, prismaRow.name) ??
          mapPrismaOpportunityToPipelineRow(prismaRow);
      }
    } catch (e) {
      console.warn("DB opportunity lookup bypassed:", e);
    }
  }

  // 3. Final dual-store resolve (covers edge aliases)
  if (!opportunity) {
    opportunity =
      (await resolveOpportunityRouteRecord(pipelines, rawKey)) ?? null;
  }

  if (!opportunity) {
    notFound();
  }

  return (
    <Suspense fallback={null}>
      <Deal360PageShell
        dealId={opportunity.id}
        companies={companies}
        pipelines={
          pipelines.some((row) => row.id === opportunity.id)
            ? pipelines
            : [opportunity, ...pipelines]
        }
        activities={activities}
        commercialPackages={commercialPackages}
      />
    </Suspense>
  );
}
