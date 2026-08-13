import { ContactsShell } from "@/components/layout/contacts-shell";
import {
  readLiveActivities,
  readLiveOutlookEvidence,
  readLivePortfolio,
} from "@/lib/prisma-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ContactsPage() {
  const [{ companies, pipelines }, activities, outlookEvidence] = await Promise.all([
    readLivePortfolio(),
    readLiveActivities(),
    readLiveOutlookEvidence(),
  ]);

  return (
    <ContactsShell
      companies={companies}
      pipelines={pipelines}
      activities={activities}
      outlookEvidence={outlookEvidence}
    />
  );
}
