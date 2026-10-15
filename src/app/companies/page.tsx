import { Suspense } from "react";
import { CompaniesOperationsShell } from "@/components/layout/companies-operations-shell";
import { compactCorrespondenceForLists } from "@/lib/company-correspondence";
import { loadCorrespondenceEvidenceByCompanyId } from "@/lib/company-correspondence-data";
import {
  readLiveActivities,
  readLiveCommercialPackages,
  readLivePortfolio,
} from "@/lib/prisma-data";
import { readAssignableStandardBioUsers } from "@/lib/standard-bio-users-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CompaniesPage() {
  const [{ companies, pipelines }, activities, commercialPackages, assignableUsers] =
    await Promise.all([
      readLivePortfolio(),
      readLiveActivities(),
      readLiveCommercialPackages(),
      readAssignableStandardBioUsers().catch(() => []),
    ]);

  // Synced Outlook mail counts as a touch — the list must say the same as the 360.
  const correspondence = compactCorrespondenceForLists(
    await loadCorrespondenceEvidenceByCompanyId(companies, { take: 1000 }),
  );

  return (
    <Suspense fallback={null}>
      <CompaniesOperationsShell
        companies={companies}
        pipelines={pipelines}
        activities={activities}
        commercialPackages={commercialPackages}
        correspondence={correspondence}
        assignableUsers={assignableUsers}
      />
    </Suspense>
  );
}
