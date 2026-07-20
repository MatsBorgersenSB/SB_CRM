import { AssistedConfigurationShell } from "@/components/administration/assisted-configuration-shell";
import { WorkspaceChrome } from "@/components/layout/workspace-chrome";
import { buildConfigurationSnapshot } from "@/lib/assisted-configuration-engine";
import {
  readActivities,
  readCommercialPackages,
  readCompanies,
  readPipelines,
} from "@/lib/pipeline-db";

export default async function AssistedConfigurationPage() {
  const [companies, pipelines, activities, commercialPackages] = await Promise.all([
    readCompanies(),
    readPipelines(),
    readActivities(),
    readCommercialPackages(),
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
