import { GrowthIntelligenceDashboardShell } from "@/components/growth-intelligence/growth-intelligence-dashboard-shell";
import { GrowthIntelligenceWorkspace } from "@/components/growth/growth-intelligence-workspace";
import { WorkspaceStack } from "@/components/ui/workspace-main";
import { readGrowthIntelligenceWorkspace } from "@/lib/fs010-growth-intelligence-data";
import { readLiveGrowthContext } from "@/lib/prisma-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function GrowthDashboardPage() {
  const [context, growthFs010] = await Promise.all([
    readLiveGrowthContext(),
    readGrowthIntelligenceWorkspace(),
  ]);

  return (
    <WorkspaceStack>
      <GrowthIntelligenceDashboardShell
        companies={context.companies}
        pipelines={context.pipelines}
        extras={{
          activities: context.activities,
          growthDeals: context.growthDeals,
          correspondence: context.correspondence,
        }}
      />
      <GrowthIntelligenceWorkspace data={growthFs010} />
    </WorkspaceStack>
  );
}
