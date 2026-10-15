import { ContactsShell } from "@/components/layout/contacts-shell";
import { compactCorrespondenceForLists } from "@/lib/company-correspondence";
import { loadCorrespondenceEvidenceByCompanyId } from "@/lib/company-correspondence-data";
import {
  readLiveActivities,
  readLiveOutlookEvidence,
  readLivePortfolio,
} from "@/lib/prisma-data";
import { readAssignableStandardBioUsers } from "@/lib/standard-bio-users-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ContactsPage() {
  const [{ companies, pipelines }, activities, outlookEvidence, assignableUsers] =
    await Promise.all([
      readLivePortfolio(),
      readLiveActivities(),
      readLiveOutlookEvidence(),
      readAssignableStandardBioUsers().catch(() => []),
    ]);

  // Synced Outlook mail counts as a touch — per person, via the addresses on each message.
  const correspondence = compactCorrespondenceForLists(
    await loadCorrespondenceEvidenceByCompanyId(companies, { take: 1000 }),
  );

  return (
    <ContactsShell
      companies={companies}
      pipelines={pipelines}
      activities={activities}
      outlookEvidence={outlookEvidence}
      correspondence={correspondence}
      assignableUsers={assignableUsers}
    />
  );
}
