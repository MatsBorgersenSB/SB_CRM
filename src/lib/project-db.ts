/**
 * Project Workspace Light persistence.
 * Prefer Prisma (Neon) so create/update works on Vercel’s read-only filesystem.
 * Fall back to JSON file (/tmp on serverless) when Prisma is unavailable.
 */

import path from "path";
import type { Prisma } from "@/generated/prisma";
import { PROJECTS } from "@/data/projects-data";
import { normalizeProjectRelationships } from "@/lib/project-relationship-utils";
import { normalizeProjectTeam } from "@/lib/project-team-utils";
import { withPrismaRetry, isPrismaConnectionError } from "@/lib/prisma";
import type { Project } from "@/types/project";
import type {
  ProjectRelatedOrganization,
  ProjectStakeholderRecord,
} from "@/types/project-relationships";

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
  >
>;

const BUNDLED_DB_PATH = path.join(process.cwd(), "src/data/projects-db.json");
const FILE_DB_PATH =
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
    ? path.join("/tmp", "projects-db.json")
    : BUNDLED_DB_PATH;

function normalizeProject(project: Project): Project {
  const seed = PROJECTS.find((entry) => entry.id === project.id);
  const withSeed: Project = {
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
  return normalizeProjectRelationships(normalizeProjectTeam(withSeed));
}

function asProject(payload: unknown): Project | null {
  if (!payload || typeof payload !== "object") return null;
  const row = payload as Project;
  if (!row.id || !row.name) return null;
  return normalizeProject(row);
}

async function prismaAvailable(): Promise<boolean> {
  try {
    await withPrismaRetry((prisma) => prisma.workspaceProject.findFirst({ take: 1 }));
    return true;
  } catch (error) {
    if (isPrismaConnectionError(error)) return false;
    // Missing table / client lag — treat as unavailable and fall back to file
    const message = error instanceof Error ? error.message : String(error);
    if (/workspaceProject|workspace_projects|does not exist|Unknown arg/i.test(message)) {
      return false;
    }
    return false;
  }
}

async function readProjectsFromPrisma(): Promise<Project[]> {
  const rows = await withPrismaRetry((prisma) =>
    prisma.workspaceProject.findMany({ orderBy: { updatedAt: "desc" } }),
  );
  return rows
    .map((row) => asProject(row.payload))
    .filter((project): project is Project => project != null);
}

async function writeProjectToPrisma(project: Project): Promise<Project> {
  const normalized = normalizeProject(project);
  await withPrismaRetry((prisma) =>
    prisma.workspaceProject.upsert({
      where: { id: normalized.id },
      create: {
        id: normalized.id,
        name: normalized.name,
        payload: normalized as unknown as Prisma.InputJsonValue,
      },
      update: {
        name: normalized.name,
        payload: normalized as unknown as Prisma.InputJsonValue,
      },
    }),
  );
  return normalized;
}

async function readFileDb(): Promise<ProjectsDatabase | null> {
  try {
    const { promises: fs } = await import("fs");
    let raw: string;
    try {
      raw = await fs.readFile(FILE_DB_PATH, "utf-8");
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code;
      if (code === "ENOENT" && FILE_DB_PATH !== BUNDLED_DB_PATH) {
        raw = await fs.readFile(BUNDLED_DB_PATH, "utf-8");
      } else {
        throw error;
      }
    }
    const parsed = JSON.parse(raw) as ProjectsDatabase;
    return {
      projects: (parsed.projects ?? []).map(normalizeProject),
    };
  } catch {
    return null;
  }
}

async function writeFileDb(database: ProjectsDatabase): Promise<void> {
  const { promises: fs } = await import("fs");
  await fs.writeFile(FILE_DB_PATH, JSON.stringify(database, null, 2), "utf-8");
}

async function ensureFileDb(): Promise<ProjectsDatabase> {
  const existing = await readFileDb();
  if (existing) {
    return { projects: (existing.projects ?? []).map(normalizeProject) };
  }
  const database: ProjectsDatabase = { projects: [] };
  try {
    await writeFileDb(database);
  } catch {
    // Read-only FS — return empty in-memory view
  }
  return database;
}

export async function readProjects(): Promise<Project[]> {
  if (await prismaAvailable()) {
    return readProjectsFromPrisma();
  }
  const database = await ensureFileDb();
  return [...database.projects];
}

export async function readProjectById(projectId: string): Promise<Project | null> {
  if (await prismaAvailable()) {
    const row = await withPrismaRetry((prisma) =>
      prisma.workspaceProject.findUnique({ where: { id: projectId } }),
    );
    return row ? asProject(row.payload) : null;
  }
  const database = await ensureFileDb();
  const project = database.projects.find((entry) => entry.id === projectId);
  return project ? normalizeProject(project) : null;
}

export async function updateProject(projectId: string, patch: ProjectPatch): Promise<Project> {
  if (await prismaAvailable()) {
    const existing = await readProjectById(projectId);
    if (!existing) throw new Error(`Project not found: ${projectId}`);
    const updated = normalizeProject({
      ...existing,
      ...patch,
      id: existing.id,
    });
    return writeProjectToPrisma(updated);
  }

  const database = await ensureFileDb();
  const index = database.projects.findIndex((project) => project.id === projectId);
  if (index === -1) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const updated = normalizeProject({
    ...database.projects[index],
    ...patch,
    id: database.projects[index].id,
  });

  database.projects[index] = updated;
  await writeFileDb(database);
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

export class DuplicateWorkspaceProjectNameError extends Error {
  readonly statusCode = 409 as const;
  readonly title: string;

  constructor(title: string) {
    super(
      `A project with the name "${title}" already exists. Please use a unique project title.`,
    );
    this.name = "DuplicateWorkspaceProjectNameError";
    this.title = title;
  }
}

export function isDuplicateWorkspaceProjectNameError(
  error: unknown,
): error is DuplicateWorkspaceProjectNameError {
  return error instanceof DuplicateWorkspaceProjectNameError;
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  const name = input.name.trim() || "Untitled Project";
  const usePrisma = await prismaAvailable();

  if (usePrisma) {
    const duplicate = await withPrismaRetry((prisma) =>
      prisma.workspaceProject.findFirst({
        where: { name: { equals: name, mode: "insensitive" } },
        select: { id: true },
      }),
    );
    if (duplicate) {
      throw new DuplicateWorkspaceProjectNameError(name);
    }
  }

  const existing = usePrisma
    ? await readProjectsFromPrisma()
    : (await ensureFileDb()).projects;

  if (!usePrisma) {
    const duplicateName = existing.some(
      (project) => project.name.trim().toLowerCase() === name.toLowerCase(),
    );
    if (duplicateName) {
      throw new DuplicateWorkspaceProjectNameError(name);
    }
  }

  const existingIds = new Set(existing.map((project) => project.id));
  const id = createProjectId(name, existingIds);

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
    name,
    kind: input.kind ?? "customer",
    owner: input.owner?.trim() ?? "",
    status: "Planning",
    stage: "Planning",
    priority: "Medium",
    health: "Needs Attention",
    strategicImportance: "Medium",
    objective: "",
    problem: "",
    successCriteria: "",
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

  if (usePrisma) {
    return writeProjectToPrisma(project);
  }

  const database = await ensureFileDb();
  database.projects.push(project);
  try {
    await writeFileDb(database);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code === "EROFS" || code === "EACCES") {
      throw new Error(
        "Cannot create project: database unavailable and filesystem is read-only. Apply workspace_projects migration and ensure DATABASE_URL is set.",
      );
    }
    throw error;
  }
  return project;
}
