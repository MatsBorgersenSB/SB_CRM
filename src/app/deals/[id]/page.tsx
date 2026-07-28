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

type Deal360PageProps = {
  params: Promise<{ id: string }>;
};

/**
 * Opportunity detail — Mission Control tabs are URL-driven:
 * `?view=overview|gaps|understanding|influence|meetings|emails|actions|ask`
 */
export default async function Deal360Page({ params }: Deal360PageProps) {
  const resolvedParams = await params;
  const dealId = normalizeRouteKey(resolvedParams.id);

  if (!dealId) {
    notFound();
  }

  try {
    const [{ companies, pipelines }, activities, commercialPackages] =
      await Promise.all([
        readLivePortfolio(),
        readLiveActivities(),
        readLiveCommercialPackages(),
      ]);

    const pipeline = await resolveOpportunityRouteRecord(pipelines, dealId);

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
      "[Deal360Page] Opportunity detail failed:",
      error instanceof Error ? error.message : error,
    );
    notFound();
  }
}
