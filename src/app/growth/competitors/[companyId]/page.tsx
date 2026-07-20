import { notFound } from "next/navigation";
import { CompetitorIntelligenceWorkspaceView } from "@/components/growth-intelligence/competitor-intelligence-workspace";
import { getCompetitorProfile, listCompetitorIds } from "@/lib/growth-competitive-intelligence-engine";
import { readCompanies, readPipelines } from "@/lib/pipeline-db";

type CompetitorIntelligencePageProps = {
  params: Promise<{ companyId: string }>;
};

export function generateStaticParams() {
  return listCompetitorIds().map((companyId) => ({ companyId }));
}

export default async function CompetitorIntelligencePage({ params }: CompetitorIntelligencePageProps) {
  const { companyId } = await params;

  if (!getCompetitorProfile(companyId)) {
    notFound();
  }

  const [companies, pipelines] = await Promise.all([readCompanies(), readPipelines()]);

  return (
    <CompetitorIntelligenceWorkspaceView
      companyId={companyId}
      companies={companies}
      pipelines={pipelines}
    />
  );
}
