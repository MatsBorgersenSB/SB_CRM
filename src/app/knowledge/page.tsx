import { KnowledgeShell } from "@/components/layout/knowledge-shell";
import {
  readActivities,
  readCompanies,
  readPipelines,
  readSmartDocsLibrary,
} from "@/lib/pipeline-db";

export default async function KnowledgePage() {
  const [pipelines, companies, activities, library] = await Promise.all([
    readPipelines(),
    readCompanies(),
    readActivities(),
    readSmartDocsLibrary(),
  ]);

  return (
    <KnowledgeShell
      companies={companies}
      pipelines={pipelines}
      activities={activities}
      library={library}
    />
  );
}
