import { Suspense } from "react";
import { Project360PageShell } from "@/components/layout/project-360-page-shell";
import { readProjectById } from "@/lib/project-db";
import { readAssignableStandardBioUsers } from "@/lib/standard-bio-users-server";
import { readActivities, readCommercialPackages, readCompanies, readPipelines } from "@/lib/pipeline-db";

type Project360PageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function Project360Page({ params }: Project360PageProps) {
  const { projectId } = await params;

  const [project, companies, pipelines, activities, commercialPackages, standardBioUsers] =
    await Promise.all([
    readProjectById(projectId),
    readCompanies(),
    readPipelines(),
    readActivities(),
    readCommercialPackages(),
    readAssignableStandardBioUsers(),
  ]);

  return (
    <Suspense fallback={null}>
      <Project360PageShell
        projectId={projectId}
        project={project}
        companies={companies}
        pipelines={pipelines}
        activities={activities}
        commercialPackages={commercialPackages}
        standardBioUsers={standardBioUsers}
      />
    </Suspense>
  );
}
