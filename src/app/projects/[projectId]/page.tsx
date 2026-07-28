import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Project360PageShell } from "@/components/layout/project-360-page-shell";
import { isNextNotFound, pickEntityRouteParam } from "@/lib/entity-route-utils";
import { readProjects } from "@/lib/project-db";
import { resolveProjectRouteRecord } from "@/lib/resolve-project-route";
import { readAssignableStandardBioUsers } from "@/lib/standard-bio-users-server";
import {
  readActivities,
  readCommercialPackages,
  readCompanies,
  readPipelines,
} from "@/lib/pipeline-db";
import type { EntityRouteParams } from "@/lib/resolvers/entity-resolver";

type Project360PageProps = {
  params: Promise<EntityRouteParams & { projectId?: string }>;
};

export default async function Project360Page({ params }: Project360PageProps) {
  const resolvedParams = await params;
  const projectId = pickEntityRouteParam(resolvedParams, ["projectId", "id"]);

  if (!projectId) {
    notFound();
  }

  try {
    const [projects, companies, pipelines, activities, commercialPackages, standardBioUsers] =
      await Promise.all([
        readProjects(),
        readCompanies(),
        readPipelines(),
        readActivities(),
        readCommercialPackages(),
        readAssignableStandardBioUsers(),
      ]);

    const project = await resolveProjectRouteRecord(projects, projectId);

    if (!project) {
      notFound();
    }

    return (
      <Suspense fallback={null}>
        <Project360PageShell
          projectId={project.id}
          project={project}
          companies={companies}
          pipelines={pipelines}
          activities={activities}
          commercialPackages={commercialPackages}
          standardBioUsers={standardBioUsers}
        />
      </Suspense>
    );
  } catch (error) {
    if (isNextNotFound(error)) throw error;
    console.error(
      "[Project360Page] Project detail failed:",
      error instanceof Error ? error.message : error,
    );
    notFound();
  }
}
