import { IntelligenceCenterShell } from "@/components/layout/intelligence-center-shell";
import { readGrowthIntelligenceWorkspace } from "@/lib/fs010-growth-intelligence-data";
import { readLiveActivities, readLivePortfolio } from "@/lib/prisma-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function IntelligenceCenterPage() {
  const [portfolio, activities, growthIntelligence] = await Promise.all([
    readLivePortfolio(),
    readLiveActivities(),
    readGrowthIntelligenceWorkspace(),
  ]);

  return (
    <IntelligenceCenterShell
      companies={portfolio.companies}
      pipelines={portfolio.pipelines}
      activities={activities}
      growthIntelligence={growthIntelligence}
    />
  );
}
