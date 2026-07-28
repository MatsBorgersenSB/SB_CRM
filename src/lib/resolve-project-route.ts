import { resolveEntity } from "@/lib/resolvers/entity-resolver";
import type { Project } from "@/types/project";

/**
 * Projects are JSON/seed-backed today (no Prisma Project model).
 * resolveEntity still runs a no-op Prisma slot so the dual-store contract is uniform.
 */
export async function resolveProjectRouteRecord(
  projects: Project[],
  routeKey: string,
): Promise<Project | undefined> {
  const record = await resolveEntity(
    routeKey,
    async () => null,
    projects as Array<Project & Record<string, unknown>>,
    {
      matchKeys: ["id", "name"],
      getMatchValues: (project) => [
        project.linkedDealId,
        project.linkedCompanyId,
        project.owner,
      ],
    },
  );

  return record ?? undefined;
}
