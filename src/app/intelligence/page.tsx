import { IntelligenceCenterShell } from "@/components/layout/intelligence-center-shell";
import { readActivities, readCompanies, readPipelines } from "@/lib/pipeline-db";

export default async function IntelligenceCenterPage() {
  const [companies, pipelines, activities] = await Promise.all([
    readCompanies(),
    readPipelines(),
    readActivities(),
  ]);

  return (
    <IntelligenceCenterShell
      companies={companies}
      pipelines={pipelines}
      activities={activities}
    />
  );
}
