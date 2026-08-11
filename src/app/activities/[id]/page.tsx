import { Suspense } from "react";
import { ActivityDetailKnowledge } from "@/components/activities/activity-detail-knowledge";
import { WorkspaceChrome } from "@/components/layout/workspace-chrome";
import { WorkspaceMain } from "@/components/ui/workspace-main";
import {
  readActivities,
  readCompanies,
  readPipelines,
  readSmartDocsLibrary,
  readCommercialPackages,
  getActivityById,
} from "@/lib/pipeline-db";
import { readAssignableStandardBioUsers } from "@/lib/standard-bio-users-server";
import { notFound } from "next/navigation";

export default async function ActivityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [
    activity,
    activities,
    companies,
    pipelines,
    smartDocsLibrary,
    commercialPackages,
    assignableUsers,
  ] = await Promise.all([
    getActivityById(id),
    readActivities(),
    readCompanies(),
    readPipelines(),
    readSmartDocsLibrary(),
    readCommercialPackages(),
    readAssignableStandardBioUsers(),
  ]);

  if (!activity) notFound();

  return (
    <WorkspaceChrome>
      <WorkspaceMain>
        <Suspense fallback={null}>
          <ActivityDetailKnowledge
            activity={activity}
            companies={companies}
            pipelines={pipelines}
            allActivities={activities}
            smartDocsLibrary={smartDocsLibrary}
            commercialPackages={commercialPackages}
            assignableUsers={assignableUsers}
          />
        </Suspense>
      </WorkspaceMain>
    </WorkspaceChrome>
  );
}
