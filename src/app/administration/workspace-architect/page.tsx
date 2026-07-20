import { WorkspaceArchitectShell } from "@/components/administration/workspace-architect-shell";
import { WorkspaceChrome } from "@/components/layout/workspace-chrome";
import { buildConfigurationSnapshot } from "@/lib/assisted-configuration-engine";
import {
  readActivities,
  readCommercialPackages,
  readCompanies,
  readPipelines,
} from "@/lib/pipeline-db";

export default async function WorkspaceArchitectPage() {
  const [companies, pipelines, activities, commercialPackages] = await Promise.all([
    readCompanies(),
    readPipelines(),
    readActivities(),
    readCommercialPackages(),
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
