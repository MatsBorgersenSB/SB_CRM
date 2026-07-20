import { ContactsShell } from "@/components/layout/contacts-shell";
import { readActivities, readCompanies, readOutlookEvidence, readPipelines } from "@/lib/pipeline-db";

export default async function ContactsPage() {
  const [companies, activities, pipelines, outlookEvidence] = await Promise.all([
    readCompanies(),
    readActivities(),
    readPipelines(),
    readOutlookEvidence(),
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
