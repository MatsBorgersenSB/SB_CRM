import { Suspense } from "react";
import { Deal360PageShell } from "@/components/layout/deal-360-page-shell";
import {
  readLiveActivities,
  readLiveCommercialPackages,
  readLivePortfolio,
} from "@/lib/prisma-data";

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
  const { id } = await params;

  const [{ companies, pipelines }, activities, commercialPackages] = await Promise.all([
    readLivePortfolio(),
    readLiveActivities(),
    readLiveCommercialPackages(),
  ]);

  return (
    <Suspense fallback={null}>
      <Deal360PageShell
        dealId={id}
        companies={companies}
        pipelines={pipelines}
        activities={activities}
        commercialPackages={commercialPackages}
      />
    </Suspense>
  );
}
