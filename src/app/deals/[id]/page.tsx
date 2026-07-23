import { Suspense } from "react";
import { Deal360PageShell } from "@/components/layout/deal-360-page-shell";
import {
  readLiveActivities,
  readLiveCommercialPackages,
  readLivePortfolio,
} from "@/lib/prisma-data";

type Deal360PageProps = {
  params: Promise<{ id: string }>;
};

/**
 * Opportunity detail — Mission Control tabs are URL-driven:
 * `?view=overview|gaps|understanding|influence|meetings|actions|ask`
 *
 * Meetings tab (`?view=meetings`) renders `<MeetingIntelligence opportunityId={id} />`
 * inside Deal360LivingWorkspace → OpportunityMissionControl.
 */
export default async function Deal360Page({ params }: Deal360PageProps) {
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
