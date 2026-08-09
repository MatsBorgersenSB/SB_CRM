import { promises as fs } from "fs";
import path from "path";
import { PROJECTS } from "@/data/projects-data";
import { normalizeProjectRelationships } from "@/lib/project-relationship-utils";
import { normalizeProjectTeam } from "@/lib/project-team-utils";
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

/** Bundled seed checked into the repo. */
const BUNDLED_DB_PATH = path.join(process.cwd(), "src/data/projects-db.json");

/**
 * On Vercel the deployment FS is read-only. Persist mutations under /tmp so
 * stakeholder/org updates do not fail with EROFS.
 */
const DB_PATH =
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

async function readRawDb(): Promise<string | null> {
  try {
    return await fs.readFile(DB_PATH, "utf-8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT" && DB_PATH !== BUNDLED_DB_PATH) {
      try {
        return await fs.readFile(BUNDLED_DB_PATH, "utf-8");
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function readDbFile(): Promise<ProjectsDatabase | null> {
  try {
    const raw = await readRawDb();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProjectsDatabase;
    return {
      projects: (parsed.projects ?? []).map(normalizeProject),
    };
  } catch {
    return null;
  }
}

async function writeDb(database: ProjectsDatabase): Promise<void> {
  await fs.writeFile(DB_PATH, JSON.stringify(database, null, 2), "utf-8");
}

async function ensureDb(): Promise<ProjectsDatabase> {
  const existing = await readDbFile();
  if (existing?.projects?.length) {
    // On Vercel, copy bundled → /tmp on first writeable ensure so PATCH can persist.
    if (DB_PATH !== BUNDLED_DB_PATH) {
      try {
        await fs.access(DB_PATH);
      } catch {
        await writeDb(existing);
      }
    }
    return existing;
  }

  const database: ProjectsDatabase = { projects: PROJECTS.map(normalizeProject) };
  await writeDb(database);
  return database;
}

export async function readProjects(): Promise<Project[]> {
  const database = await ensureDb();
  return [...database.projects];
}

export async function readProjectById(projectId: string): Promise<Project | null> {
  const database = await ensureDb();
  const project = database.projects.find((entry) => entry.id === projectId);
  return project ? normalizeProject(project) : null;
}

export async function updateProject(projectId: string, patch: ProjectPatch): Promise<Project> {
  const database = await ensureDb();
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
  await writeDb(database);
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
  const database = await ensureDb();
  const existingIds = new Set(database.projects.map((project) => project.id));
  const id = createProjectId(input.name, existingIds);

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

  database.projects.push(project);
  await writeDb(database);
  return project;
}
