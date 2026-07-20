import { GrowthIntelligenceDashboardShell } from "@/components/growth-intelligence/growth-intelligence-dashboard-shell";
import { readCompanies, readPipelines } from "@/lib/pipeline-db";

export default async function GrowthDashboardPage() {
  const [companies, pipelines] = await Promise.all([readCompanies(), readPipelines()]);

  return <GrowthIntelligenceDashboardShell companies={companies} pipelines={pipelines} />;
}
