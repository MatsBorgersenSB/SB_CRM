import { ActivitiesShell } from "@/components/layout/activities-shell";
import {
  readLiveActivities,
  readLiveCompanies,
  readLivePipelines,
} from "@/lib/prisma-data";
import { readAssignableStandardBioUsers } from "@/lib/standard-bio-users-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ActivitiesPage() {
  const [activities, companies, pipelines, assignableUsers] = await Promise.all([
    readLiveActivities(),
    readLiveCompanies(),
    readLivePipelines(),
    readAssignableStandardBioUsers(),
  ]);

  return (
    <ActivitiesShell
      activities={activities}
      companies={companies}
      pipelines={pipelines}
      assignableUsers={assignableUsers}
    />
  );
}
