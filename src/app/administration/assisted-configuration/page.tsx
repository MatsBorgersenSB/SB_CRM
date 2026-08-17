import { AssistedConfigurationShell } from "@/components/administration/assisted-configuration-shell";
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

export default async function AssistedConfigurationPage() {
  const [companies, pipelines, activities, commercialPackages] = await Promise.all([
    readLiveCompanies(),
    readLivePipelines(),
    readLiveActivities(),
    readLiveCommercialPackages(),
  ]);

  const snapshot = buildConfigurationSnapshot({
    companies,
    pipelines,
    activities,
    commercialPackages,
  });

  return (
    <WorkspaceChrome>
      <AssistedConfigurationShell snapshot={snapshot} />
    </WorkspaceChrome>
  );
}
