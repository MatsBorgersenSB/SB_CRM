import { notFound } from "next/navigation";
import { EventPlanningWorkspaceView } from "@/components/growth-intelligence/event-planning-workspace";
import { getGrowthEventById, listGrowthEventIds } from "@/lib/growth-event-planning-engine";
import { readLiveCompanies } from "@/lib/prisma-data";

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

  const companies = await readLiveCompanies();

  return <EventPlanningWorkspaceView eventId={eventId} companies={companies} />;
}
