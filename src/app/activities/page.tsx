import { ActivitiesShell } from "@/components/layout/activities-shell";
import { readActivities, readCompanies, readPipelines } from "@/lib/pipeline-db";
import { readAssignableStandardBioUsers } from "@/lib/standard-bio-users-server";

export default async function ActivitiesPage() {
  const [activities, companies, pipelines, assignableUsers] = await Promise.all([
    readActivities(),
    readCompanies(),
    readPipelines(),
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
