import { KnowledgeShell } from "@/components/layout/knowledge-shell";
import { readActivities, readCompanies, readPipelines } from "@/lib/pipeline-db";

export default async function KnowledgePage() {
  const [pipelines, companies, activities] = await Promise.all([
    readPipelines(),
    readCompanies(),
    readActivities(),
  ]);

  return (
    <KnowledgeShell companies={companies} pipelines={pipelines} activities={activities} />
  );
}
