import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Deal360PageShell } from "@/components/layout/deal-360-page-shell";
import { isNextNotFound, normalizeRouteKey } from "@/lib/entity-route-utils";
import {
  readLiveActivities,
  readLiveCommercialPackages,
  readLivePortfolio,
} from "@/lib/prisma-data";
import { resolveOpportunityRouteRecord } from "@/lib/resolve-opportunity-route";

type OpportunityDetailPageProps = {
  params: Promise<{ id: string }>;
};

/**
 * FS-012 / relationship-first alias — Opportunity Workspace at `/opportunities/[id]`.
 * Same Mission Control shell as `/deals/[id]`.
 */
export default async function OpportunityDetailPage({
  params,
}: OpportunityDetailPageProps) {
  const resolvedParams = await params;
  const opportunityId = normalizeRouteKey(resolvedParams.id);

  if (!opportunityId) {
    notFound();
  }

  try {
    const [{ companies, pipelines }, activities, commercialPackages] =
      await Promise.all([
        readLivePortfolio(),
        readLiveActivities(),
        readLiveCommercialPackages(),
      ]);

    const pipeline = await resolveOpportunityRouteRecord(
      pipelines,
      opportunityId,
    );

    if (!pipeline) {
      notFound();
    }

    return (
      <Suspense fallback={null}>
        <Deal360PageShell
          dealId={pipeline.id}
          companies={companies}
          pipelines={pipelines}
          activities={activities}
          commercialPackages={commercialPackages}
        />
      </Suspense>
    );
  } catch (error) {
    if (isNextNotFound(error)) throw error;
    console.error(
      "[OpportunityDetailPage] Opportunity detail failed:",
      error instanceof Error ? error.message : error,
    );
    notFound();
  }
}
