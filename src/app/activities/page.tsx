import { ActivitiesShell } from "@/components/layout/activities-shell";
import { readActivities, readCompanies, readPipelines } from "@/lib/pipeline-db";

export default async function ActivitiesPage() {
  const [activities, companies, pipelines] = await Promise.all([
    readActivities(),
    readCompanies(),
    readPipelines(),
  ]);

  return (
    <ActivitiesShell
      activities={activities}
      companies={companies}
      pipelines={pipelines}
    />
  );
}
