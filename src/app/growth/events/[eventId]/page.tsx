import { notFound } from "next/navigation";
import { EventPlanningWorkspaceView } from "@/components/growth-intelligence/event-planning-workspace";
import { getGrowthEventById, listGrowthEventIds } from "@/lib/growth-event-planning-engine";
import { readCompanies } from "@/lib/pipeline-db";

type EventPlanningPageProps = {
  params: Promise<{ eventId: string }>;
};

export function generateStaticParams() {
  return listGrowthEventIds().map((eventId) => ({ eventId }));
}

export default async function EventPlanningPage({ params }: EventPlanningPageProps) {
  const { eventId } = await params;

  if (!getGrowthEventById(eventId)) {
    notFound();
  }

  const companies = await readCompanies();

  return <EventPlanningWorkspaceView eventId={eventId} companies={companies} />;
}
