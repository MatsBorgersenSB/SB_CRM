import { KnowledgeShell } from "@/components/layout/knowledge-shell";
import {
  readLiveActivities,
  readLiveCompanies,
  readLivePipelines,
  readLiveResearchReports,
  readLiveSmartDocsLibrary,
} from "@/lib/prisma-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type KnowledgePageProps = {
  searchParams?: Promise<{ report?: string }>;
};

export default async function KnowledgePage({ searchParams }: KnowledgePageProps) {
  const resolvedParams = searchParams ? await searchParams : undefined;
  const [pipelines, companies, activities, library, researchReports] = await Promise.all([
    readLivePipelines(),
    readLiveCompanies(),
    readLiveActivities(),
    readLiveSmartDocsLibrary(),
    readLiveResearchReports(),
  ]);

  return (
    <KnowledgeShell
      companies={companies}
      pipelines={pipelines}
      activities={activities}
      library={library}
      researchReports={researchReports}
      selectedReportId={resolvedParams?.report?.trim() || undefined}
    />
  );
}
