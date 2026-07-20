import { AppShell } from "@/components/layout/app-shell";
import { readActivities, readCompanies, readPipelines } from "@/lib/pipeline-db";

export default async function DealsPage() {
  const [pipelines, companies, activities] = await Promise.all([
    readPipelines(),
    readCompanies(),
    readActivities(),
  ]);

  return (
    <AppShell
      initialPipelines={pipelines}
      companies={companies}
      activities={activities}
    />
  );
}
