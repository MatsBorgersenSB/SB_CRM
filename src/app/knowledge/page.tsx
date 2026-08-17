import { KnowledgeShell } from "@/components/layout/knowledge-shell";
import {
  readLiveActivities,
  readLiveCompanies,
  readLivePipelines,
  readLiveSmartDocsLibrary,
} from "@/lib/prisma-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function KnowledgePage() {
  const [pipelines, companies, activities, library] = await Promise.all([
    readLivePipelines(),
    readLiveCompanies(),
    readLiveActivities(),
    readLiveSmartDocsLibrary(),
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
