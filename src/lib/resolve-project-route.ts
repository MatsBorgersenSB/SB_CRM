import { resolveEntity } from "@/lib/resolvers/entity-resolver";
import type { Project } from "@/types/project";

/** Resolve project from JSON/seed portfolio (no Prisma Project model yet). */
export async function resolveProjectRouteRecord(
  projects: Project[],
  routeKey: string,
): Promise<Project | undefined> {
  const key = routeKey.trim();
  if (!key) return undefined;

  const lower = key.toLowerCase();
  const direct = projects.find(
    (project) =>
      project.id.toLowerCase() === lower ||
      project.name.trim().toLowerCase() === lower,
  );
  if (direct) return direct;

  const record = await resolveEntity(
    key,
    async () => null,
    projects as Array<Project & Record<string, unknown>>,
    {
      preferFallbackFirst: true,
      matchKeys: ["id", "name"],
      getMatchValues: (project) => [
        project.linkedDealId,
        project.linkedCompanyId,
      ],
    },
  );

  return record ?? undefined;
}
