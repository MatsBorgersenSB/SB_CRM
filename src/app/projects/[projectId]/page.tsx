import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Project360PageShell } from "@/components/layout/project-360-page-shell";
import { pickEntityRouteParam } from "@/lib/entity-route-utils";
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
  params: Promise<EntityRouteParams>;
};

export default async function Project360Page({ params }: Project360PageProps) {
  const resolvedParams = await params;
  const rawKey = pickEntityRouteParam(resolvedParams, ["projectId", "id"]);

  if (!rawKey) {
    notFound();
  }

  const [projects, companies, pipelines, activities, commercialPackages, standardBioUsers] =
    await Promise.all([
      readProjects(),
      readCompanies(),
      readPipelines(),
      readActivities(),
      readCommercialPackages(),
      readAssignableStandardBioUsers(),
    ]);

  const project = await resolveProjectRouteRecord(projects, rawKey);

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
}
