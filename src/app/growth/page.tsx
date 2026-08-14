import { GrowthIntelligenceDashboardShell } from "@/components/growth-intelligence/growth-intelligence-dashboard-shell";
import { GrowthIntelligenceWorkspace } from "@/components/growth/growth-intelligence-workspace";
import { WorkspaceStack } from "@/components/ui/workspace-main";
import { readGrowthIntelligenceWorkspace } from "@/lib/fs010-growth-intelligence-data";
import { readLivePortfolio } from "@/lib/prisma-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function GrowthDashboardPage() {
  const [portfolio, growthFs010] = await Promise.all([
    readLivePortfolio(),
    readGrowthIntelligenceWorkspace(),
  ]);

  return (
    <WorkspaceStack>
      <GrowthIntelligenceWorkspace data={growthFs010} />
      <GrowthIntelligenceDashboardShell
        companies={portfolio.companies}
        pipelines={portfolio.pipelines}
      />
    </WorkspaceStack>
  );
}
