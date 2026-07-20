import { Suspense } from "react";
import { ProjectsOperationsShell } from "@/components/layout/projects-operations-shell";
import { readProjects } from "@/lib/project-db";

export default async function ProjectsPage() {
  const projects = await readProjects();

  return (
    <Suspense fallback={null}>
      <ProjectsOperationsShell projects={projects} />
    </Suspense>
  );
}
