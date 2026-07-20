import { M365PreviewWorkspace } from "@/components/m365/m365-preview-workspace";
import { readActivities, readCompanies, readOutlookEvidence, readPipelines } from "@/lib/pipeline-db";

export default async function M365PreviewPage() {
  const [companies, pipelines, activities, outlookEvidence] = await Promise.all([
    readCompanies(),
    readPipelines(),
    readActivities(),
    readOutlookEvidence(),
  ]);
  const defaultCompanyId = companies[0]?.CompanyID ?? "";

  return (
    <M365PreviewWorkspace
      companies={companies}
      pipelines={pipelines}
      activities={activities}
      outlookEvidence={outlookEvidence}
      defaultCompanyId={defaultCompanyId}
    />
  );
}
