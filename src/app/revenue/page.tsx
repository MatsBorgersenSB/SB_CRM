import { RevenueIntelligenceChrome } from "@/components/revenue-intelligence/revenue-intelligence-chrome";
import { RevenueIntelligenceDashboard } from "@/components/revenue-intelligence/revenue-dashboard";
import {
  readActivities,
  readCommercialPackages,
  readCompanies,
  readPipelines,
} from "@/lib/pipeline-db";

export default async function RevenueIntelligencePage() {
  const [companies, pipelines, activities, commercialPackages] = await Promise.all([
    readCompanies(),
    readPipelines(),
    readActivities(),
    readCommercialPackages(),
  ]);

  return (
    <RevenueIntelligenceChrome companies={companies}>
      <RevenueIntelligenceDashboard
        companies={companies}
        pipelines={pipelines}
        activities={activities}
        commercialPackages={commercialPackages}
      />
    </RevenueIntelligenceChrome>
  );
}
