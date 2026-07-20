import { Suspense } from "react";
import { Contact360PageShell } from "@/components/layout/contact-360-page-shell";
import { readProjects } from "@/lib/project-db";
import { readActivities, readCommercialPackages, readCompanies, readOutlookEvidence, readPipelines } from "@/lib/pipeline-db";

type Contact360PageProps = {
  params: Promise<{ contactId: string }>;
};

export default async function Contact360Page({ params }: Contact360PageProps) {
  const { contactId } = await params;

  const [companies, pipelines, activities, commercialPackages, outlookEvidence, projects] = await Promise.all([
    readCompanies(),
    readPipelines(),
    readActivities(),
    readCommercialPackages(),
    readOutlookEvidence(),
    readProjects(),
  ]);

  return (
    <Suspense fallback={null}>
      <Contact360PageShell
        contactId={contactId}
        companies={companies}
        pipelines={pipelines}
        activities={activities}
        commercialPackages={commercialPackages}
        outlookEvidence={outlookEvidence}
        projects={projects}
      />
    </Suspense>
  );
}
