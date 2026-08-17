import { RevenueIntelligenceChrome } from "@/components/revenue-intelligence/revenue-intelligence-chrome";
import { RevenueIntelligenceDashboard } from "@/components/revenue-intelligence/revenue-dashboard";
import {
  readLiveActivities,
  readLiveCommercialPackages,
  readLiveCompanies,
  readLivePipelines,
} from "@/lib/prisma-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RevenueIntelligencePage() {
  const [companies, pipelines, activities, commercialPackages] = await Promise.all([
    readLiveCompanies(),
    readLivePipelines(),
    readLiveActivities(),
    readLiveCommercialPackages(),
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
