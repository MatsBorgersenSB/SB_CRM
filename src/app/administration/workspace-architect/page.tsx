import { WorkspaceArchitectShell } from "@/components/administration/workspace-architect-shell";
import { WorkspaceChrome } from "@/components/layout/workspace-chrome";
import { buildConfigurationSnapshot } from "@/lib/assisted-configuration-engine";
import {
  readLiveActivities,
  readLiveCommercialPackages,
  readLiveCompanies,
  readLivePipelines,
} from "@/lib/prisma-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function WorkspaceArchitectPage() {
  const [companies, pipelines, activities, commercialPackages] = await Promise.all([
    readLiveCompanies(),
    readLivePipelines(),
    readLiveActivities(),
    readLiveCommercialPackages(),
  ]);

  const baselineSnapshot = buildConfigurationSnapshot({
    companies,
    pipelines,
    activities,
    commercialPackages,
  });

  return (
    <WorkspaceChrome>
      <WorkspaceArchitectShell baselineSnapshot={baselineSnapshot} />
    </WorkspaceChrome>
  );
}
