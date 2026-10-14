import { Suspense } from "react";
import { ActivitiesShell } from "@/components/layout/activities-shell";
import {
  readLiveActivities,
  readLiveCompanies,
  readLivePipelines,
} from "@/lib/prisma-data";
import { readSyncedMailSummary } from "@/lib/email-intelligence-data";
import { readAssignableStandardBioUsers } from "@/lib/standard-bio-users-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ActivitiesPage() {
  const [activities, companies, pipelines, assignableUsers, mail] = await Promise.all([
    readLiveActivities(),
    readLiveCompanies(),
    readLivePipelines(),
    readAssignableStandardBioUsers(),
    readSyncedMailSummary(),
  ]);

  return (
    <Suspense fallback={null}>
      <ActivitiesShell
        activities={activities}
        companies={companies}
        pipelines={pipelines}
        assignableUsers={assignableUsers}
        syncedMail={mail}
      />
    </Suspense>
  );
}
