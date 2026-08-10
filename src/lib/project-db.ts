import { promises as fs } from "fs";
import path from "path";
import { PROJECTS } from "@/data/projects-data";
import { getPrisma } from "@/lib/prisma";
import {
  detachCompanyFromProject,
  normalizeProjectRelationships,
} from "@/lib/project-relationship-utils";
import { normalizeProjectTeam } from "@/lib/project-team-utils";
import type { Project } from "@/types/project";
import type {
  ProjectRelatedOrganization,
  ProjectStakeholderRecord,
} from "@/types/project-relationships";
import type { Prisma } from "@/generated/prisma";

/**
 * Known false pilot links — Reality First corrections.
 * DorsetGM (CO-1009) was seeded as Carbon Emergente's customer/site owner
 * without a real company↔project relationship.
 */
const FALSE_PROJECT_COMPANY_LINKS: ReadonlyArray<{ projectId: string; companyId: string }> = [
  { projectId: "PRJ-CARBON-EMERGENTE", companyId: "CO-1009" },
];

export type ProjectsDatabase = {
  projects: Project[];
};

export type ProjectPatch = Partial<
  Pick<
    Project,
    | "owner"
    | "team"
    | "relatedOrganizations"
    | "projectStakeholders"
    | "removedStakeholders"
    | "linkedCompanyId"
    | "kind"
    | "name"
    | "status"
    | "stage"
    | "priority"
    | "health"
    | "strategicImportance"
    | "objective"
    | "problem"
    | "successCriteria"
    | "discoveryAnswers"
    | "linkedDealId"
  >
>;

/** Bundled seed checked into the repo (first-time Neon seed only). */
const BUNDLED_DB_PATH = path.join(process.cwd(), "src/data/projects-db.json");

function normalizeProject(project: Project): Project {
  const seed = PROJECTS.find((entry) => entry.id === project.id);
  let withSeed: Project = {
    ...project,
    team: project.team?.length ? project.team : (seed?.team ?? []),
    relatedOrganizations:
      project.relatedOrganizations !== undefined
        ? project.relatedOrganizations
        : seed?.relatedOrganizations,
    projectStakeholders:
      project.projectStakeholders !== undefined
        ? project.projectStakeholders
        : seed?.projectStakeholders,
    removedStakeholders: project.removedStakeholders ?? seed?.removedStakeholders ?? [],
    stakeholders: project.stakeholders ?? seed?.stakeholders,
    internalMembers: project.internalMembers ?? seed?.internalMembers,
  };

  for (const link of FALSE_PROJECT_COMPANY_LINKS) {
    if (withSeed.id !== link.projectId) continue;
    withSeed = detachCompanyFromProject(withSeed, link.companyId).project;
  }

  return normalizeProjectRelationships(normalizeProjectTeam(withSeed));
}

function rowToProject(row: { id: string; data: unknown }): Project {
  const payload =
    row.data && typeof row.data === "object"
      ? (row.data as Project)
      : ({ id: row.id, name: row.id } as Project);
  return normalizeProject({ ...payload, id: row.id });
}

async function loadBundledSeedProjects(): Promise<Project[]> {
  try {
    const raw = await fs.readFile(BUNDLED_DB_PATH, "utf-8");
    const parsed = JSON.parse(raw) as ProjectsDatabase;
    if (Array.isArray(parsed.projects) && parsed.projects.length > 0) {
      return parsed.projects.map(normalizeProject);
    }
  } catch {
    // Fall through to in-code seed.
  }
  return PROJECTS.map(normalizeProject);
}

/**
 * Persist Reality First repairs for known false company↔project links that
 * already landed in Neon from the pilot seed (ensureSeeded only runs when empty).
 */
async function repairFalseProjectCompanyLinks(): Promise<void> {
  const prisma = getPrisma();

  for (const link of FALSE_PROJECT_COMPANY_LINKS) {
    const row = await prisma.projectWorkspace.findUnique({
      where: { id: link.projectId },
    });
    if (!row) continue;

    const payload =
      row.data && typeof row.data === "object"
        ? (row.data as Project)
        : ({ id: row.id, name: row.name } as Project);
    const current = { ...payload, id: row.id };
    const { project: repaired, changed } = detachCompanyFromProject(current, link.companyId);
    if (!changed) continue;

    const normalized = normalizeProject(repaired);
    await prisma.projectWorkspace.update({
      where: { id: row.id },
      data: {
        name: normalized.name,
        kind: normalized.kind,
        data: normalized as unknown as Prisma.InputJsonValue,
      },
    });
  }
}

/**
 * Seed Neon once from the bundled JSON so existing projects (Carbon Emergente, etc.)
 * survive the move off ephemeral /tmp filesystem storage.
 */
async function ensureSeeded(): Promise<void> {
  const prisma = getPrisma();
  const count = await prisma.projectWorkspace.count();
  if (count === 0) {
    const projects = await loadBundledSeedProjects();
    if (projects.length > 0) {
      await prisma.projectWorkspace.createMany({
        data: projects.map((project) => ({
          id: project.id,
          name: project.name,
          kind: project.kind,
          data: project as unknown as Prisma.InputJsonValue,
        })),
        skipDuplicates: true,
      });
    }
  }

  await repairFalseProjectCompanyLinks();
}

export async function readProjects(): Promise<Project[]> {
  await ensureSeeded();
  const rows = await getPrisma().projectWorkspace.findMany({
    orderBy: { name: "asc" },
  });
  return rows.map(rowToProject);
}

export async function readProjectById(projectId: string): Promise<Project | null> {
  await ensureSeeded();
  const row = await getPrisma().projectWorkspace.findUnique({
    where: { id: projectId },
  });
  return row ? rowToProject(row) : null;
}

export async function updateProject(projectId: string, patch: ProjectPatch): Promise<Project> {
  await ensureSeeded();
  const prisma = getPrisma();
  const existing = await prisma.projectWorkspace.findUnique({
    where: { id: projectId },
  });

  if (!existing) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const current = rowToProject(existing);
  const updated = normalizeProject({
    ...current,
    ...patch,
    id: existing.id,
    discoveryAnswers:
      patch.discoveryAnswers !== undefined
        ? { ...(current.discoveryAnswers ?? {}), ...patch.discoveryAnswers }
        : current.discoveryAnswers,
  });

  await prisma.projectWorkspace.update({
    where: { id: projectId },
    data: {
      name: updated.name,
      kind: updated.kind,
      data: updated as unknown as Prisma.InputJsonValue,
    },
  });

  return updated;
}

export async function updateProjectStakeholders(
  projectId: string,
  projectStakeholders: ProjectStakeholderRecord[],
  removedStakeholders?: Project["removedStakeholders"],
): Promise<Project> {
  return updateProject(projectId, {
    projectStakeholders,
    ...(removedStakeholders !== undefined ? { removedStakeholders } : {}),
  });
}

export async function updateProjectOrganizations(
  projectId: string,
  relatedOrganizations: ProjectRelatedOrganization[],
): Promise<Project> {
  const primary = relatedOrganizations.find((org) => org.isPrimary) ?? relatedOrganizations[0];
  return updateProject(projectId, {
    relatedOrganizations,
    linkedCompanyId: primary?.companyId,
  });
}

/** @deprecated Use updateProjectStakeholders */
export async function updateProjectTeam(
  projectId: string,
  team: Project["team"],
): Promise<Project> {
  return updateProject(projectId, { team });
}

export type CreateProjectInput = {
  name: string;
  kind?: Project["kind"];
  linkedCompanyId?: string;
  linkedDealId?: string;
  owner?: string;
};

function createProjectId(name: string, existingIds: Set<string>): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
  let candidate = `PRJ-${slug || "new"}`.toUpperCase();
  let counter = 1;
  while (existingIds.has(candidate)) {
    candidate = `PRJ-${slug || "new"}-${counter}`.toUpperCase();
    counter += 1;
  }
  return candidate;
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  await ensureSeeded();
  const prisma = getPrisma();
  const existing = await prisma.projectWorkspace.findMany({ select: { id: true } });
  const existingIds = new Set(existing.map((row) => row.id));
  const id = createProjectId(input.name, existingIds);

  const kind = input.kind ?? "customer";
  const relatedOrganizations = input.linkedCompanyId
    ? [
        {
          id: `org-${Date.now()}-primary`,
          companyId: input.linkedCompanyId,
          organizationType: "customer" as const,
          isPrimary: true,
          label: "Primary customer",
        },
      ]
    : [];

  const project: Project = normalizeProject({
    id,
    name: input.name.trim() || "Untitled Project",
    kind,
    owner: input.owner?.trim() ?? "",
    status: "Planning",
    stage: "Planning",
    priority: "Medium",
    health: "Needs Attention",
    strategicImportance: "Medium",
    objective: "",
    problem: "",
    successCriteria: "",
    discoveryAnswers: {},
    linkedCompanyId: input.linkedCompanyId,
    linkedDealId: input.linkedDealId,
    relatedOrganizations,
    projectStakeholders: [],
    removedStakeholders: [],
    team: [],
    milestones: [],
    decisions: [],
    risks: [],
  });

  await prisma.projectWorkspace.create({
    data: {
      id: project.id,
      name: project.name,
      kind: project.kind,
      data: project as unknown as Prisma.InputJsonValue,
    },
  });

  return project;
}
