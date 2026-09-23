import { DashboardShell } from "@/components/layout/dashboard-shell";
import { loadCorrespondenceEvidenceByCompanyId } from "@/lib/company-correspondence-data";
import { readLiveFocusContext, readLiveSmartDocsLibrary } from "@/lib/prisma-data";
import { listPendingTenders } from "@/lib/tenders/queries";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  const { companies, pipelines, activities, commercialPackages } =
    await readLiveFocusContext();

  const [correspondenceByCompanyId, smartDocs, tenders] = await Promise.all([
    loadCorrespondenceEvidenceByCompanyId(companies, { take: 100 }).catch(
      () => new Map(),
    ),
    readLiveSmartDocsLibrary().catch(() => []),
    listPendingTenders({ take: 12 }).catch(() => []),
  ]);

  return (
    <DashboardShell
      companies={companies}
      pipelines={pipelines}
      activities={activities}
      commercialPackages={commercialPackages}
      correspondenceByCompanyId={Object.fromEntries(correspondenceByCompanyId)}
      smartDocs={smartDocs}
      tenders={tenders}
    />
  );
}
