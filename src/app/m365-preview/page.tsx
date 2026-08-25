import { M365PreviewWorkspace } from "@/components/m365/m365-preview-workspace";
import {
  readLiveActivities,
  readLiveOutlookEvidence,
  readLivePortfolio,
} from "@/lib/prisma-data";

export const dynamic = "force-dynamic";

export default async function M365PreviewPage() {
  const [{ companies, pipelines }, activities, outlookEvidence] = await Promise.all([
    readLivePortfolio(),
    readLiveActivities(),
    readLiveOutlookEvidence(),
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
