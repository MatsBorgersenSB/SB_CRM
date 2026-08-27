import { buildM365AccountWorkspace } from "@/lib/m365";
import { m365Error, m365Json } from "@/lib/m365/api-response";
import { loadM365PaneContext } from "@/lib/m365/pane-context";
import { readProjectById, readProjects } from "@/lib/project-db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");
  const email = searchParams.get("email");
  const projectId = searchParams.get("projectId");

  if (!companyId && !email && !projectId) {
    return m365Error("Provide companyId, projectId, or email query parameter", 400);
  }

  try {
    let contextLabel: string | undefined;
    let resolvedCompanyId = companyId;

    if (projectId) {
      const project =
        (await readProjectById(projectId)) ??
        (await readProjects()).find((p) => p.id === projectId);
      if (!project) {
        return m365Error("No matching project found for this context", 404);
      }
      const linked =
        project.linkedCompanyId?.trim() ||
        project.relatedOrganizations?.find((o) => o.isPrimary)?.companyId ||
        project.relatedOrganizations?.find((o) => o.organizationType === "customer")
          ?.companyId ||
        project.relatedOrganizations?.[0]?.companyId;
      if (!linked) {
        return m365Error(
          `Project ${project.name} has no linked company yet — link a company on the project first.`,
          404,
        );
      }
      resolvedCompanyId = linked;
      contextLabel = `Project · ${project.name}`;
    }

    const { ctx, resolved } = await loadM365PaneContext({
      email,
      companyId: resolvedCompanyId,
    });

    if (!resolved) {
      return m365Error("No matching account found for this context", 404);
    }

    const payload = buildM365AccountWorkspace(resolved.company, ctx);
    return m365Json({
      ...payload,
      ...(contextLabel ? { contextLabel } : {}),
    });
  } catch {
    return m365Error("Failed to build account workspace intelligence", 500);
  }
}
