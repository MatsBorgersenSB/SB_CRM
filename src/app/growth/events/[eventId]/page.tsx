import { notFound } from "next/navigation";
import { EventPlanningWorkspaceView } from "@/components/growth-intelligence/event-planning-workspace";
import { getGrowthEventById, listGrowthEventIds } from "@/lib/growth-event-planning-engine";
import { buildGrowthIntelligence } from "@/lib/growth-intelligence-data";
import { readLiveGrowthContext } from "@/lib/prisma-data";

type EventPlanningPageProps = {
  params: Promise<{ eventId: string }>;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export function generateStaticParams() {
  return listGrowthEventIds().map((eventId) => ({ eventId }));
}

export default async function EventPlanningPage({ params }: EventPlanningPageProps) {
  const { eventId } = await params;

  if (!getGrowthEventById(eventId)) {
    notFound();
  }

  const context = await readLiveGrowthContext();
  const snapshot = buildGrowthIntelligence(context.companies, context.pipelines, {
    activities: context.activities,
    growthDeals: context.growthDeals,
    correspondence: context.correspondence,
  });
  const meetingTargets = snapshot.superSkills.meetingMachine.filter(
    (target) => target.eventId === eventId,
  );

  return (
    <EventPlanningWorkspaceView
      eventId={eventId}
      companies={context.companies}
      meetingTargets={meetingTargets}
    />
  );
}
