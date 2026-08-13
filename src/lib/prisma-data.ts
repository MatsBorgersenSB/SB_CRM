import "server-only";

import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type { Activity } from "@/types/activity";
import type { CommercialPackage } from "@/types/commercial-package";
import type { Project } from "@/types/project";
import { filterActivitiesToLiveEntities } from "@/lib/activity-utils";
import { isPrismaConnectionError, withPrismaRetry } from "@/lib/prisma";
import {
  mapPrismaCompanyToApp,
  mapPrismaOpportunityToPipelineRow,
} from "@/lib/prisma-mappers";
import {
  readActivities as readJsonActivities,
  readCommercialPackages as readJsonCommercialPackages,
  readCompanies as readJsonCompanies,
  readOutlookEvidence as readJsonOutlookEvidence,
  readPipelines as readJsonPipelines,
} from "@/lib/pipeline-db";
import { readProjects } from "@/lib/project-db";

export type LivePortfolio = {
  companies: Company[];
  pipelines: PipelineRow[];
  source: "prisma" | "json";
};

export type LiveFocusContext = {
  companies: Company[];
  pipelines: PipelineRow[];
  activities: Activity[];
  commercialPackages: CommercialPackage[];
  projects: Project[];
  source: "prisma" | "json";
};

/**
 * Load Companies (with Contacts) and Opportunities from PostgreSQL via Prisma.
 * Falls back to the local JSON store if Prisma is unavailable.
 */
export async function readLivePortfolio(): Promise<LivePortfolio> {
  try {
    const [companies, opportunities] = await withPrismaRetry((prisma) =>
      Promise.all([
        prisma.company.findMany({
          where: { status: "active" },
          include: {
            contacts: { where: { status: "active" } },
            opportunities: { select: { id: true } },
          },
          orderBy: { name: "asc" },
        }),
        prisma.opportunity.findMany({
          where: { status: { in: ["open", "on_hold"] } },
          include: { company: { select: { id: true, name: true } } },
          orderBy: { updatedAt: "desc" },
        }),
      ]),
    );

    if (companies.length === 0 && opportunities.length === 0) {
      // Empty registry — only then fall back to seed JSON. Never replace a
      // non-empty Prisma result; Outlook creates would vanish from lists.
      const [jsonCompanies, jsonPipelines] = await Promise.all([
        readJsonCompanies(),
        readJsonPipelines(),
      ]);
      console.warn(
        "[prisma-data] Prisma registry empty; using JSON portfolio fallback",
      );
      return { companies: jsonCompanies, pipelines: jsonPipelines, source: "json" };
    }

    return {
      companies: companies.map(mapPrismaCompanyToApp),
      pipelines: opportunities.map(mapPrismaOpportunityToPipelineRow),
      source: "prisma",
    };
  } catch (error) {
    const hint = isPrismaConnectionError(error)
      ? " (DB connection closed — ensure `npx prisma dev` is running, then refresh)"
      : "";
    console.warn(
      `[prisma-data] Falling back to JSON portfolio${hint}:`,
      error instanceof Error ? error.message : error,
    );

    // Production / Vercel: seed JSON must not replace the Prisma registry.
    // Outlook creates (CO-/CT-) live only in Postgres — a silent JSON fallback
    // makes brand-new contacts/companies disappear from list pages.
    const registryConfigured = Boolean(
      process.env.DATABASE_URL || process.env.DIRECT_URL,
    );
    if (registryConfigured && process.env.NODE_ENV === "production") {
      throw error instanceof Error
        ? error
        : new Error("Failed to load live portfolio from Prisma");
    }

    const [companies, pipelines] = await Promise.all([
      readJsonCompanies(),
      readJsonPipelines(),
    ]);
    return { companies, pipelines, source: "json" };
  }
}

export async function readLiveCompanies(): Promise<Company[]> {
  const portfolio = await readLivePortfolio();
  return portfolio.companies;
}

export async function readLivePipelines(): Promise<PipelineRow[]> {
  const portfolio = await readLivePortfolio();
  return portfolio.pipelines;
}

/** Activities remain on the JSON/SharePoint store until modeled in Prisma. */
export async function readLiveActivities() {
  return readJsonActivities();
}

export async function readLiveCommercialPackages() {
  return readJsonCommercialPackages();
}

export async function readLiveOutlookEvidence() {
  return readJsonOutlookEvidence();
}

/**
 * Focus / My Attention context — live companies & opportunities, with
 * activities and commercial packages pruned to entities that still exist.
 * Reality First: seed/orphan Nordic-style rows never reach the queue.
 */
export async function readLiveFocusContext(): Promise<LiveFocusContext> {
  const [portfolio, activities, commercialPackages, projects] = await Promise.all([
    readLivePortfolio(),
    readJsonActivities(),
    readJsonCommercialPackages(),
    readProjects().catch((error) => {
      console.warn(
        "[prisma-data] Could not load projects for Focus scope:",
        error instanceof Error ? error.message : error,
      );
      return [] as Project[];
    }),
  ]);

  const projectIds = new Set(projects.map((project) => project.id));
  const dealIds = new Set(portfolio.pipelines.map((pipeline) => pipeline.id));

  return {
    companies: portfolio.companies,
    pipelines: portfolio.pipelines,
    activities: filterActivitiesToLiveEntities(activities, {
      companies: portfolio.companies,
      pipelines: portfolio.pipelines,
      projectIds,
    }),
    commercialPackages: commercialPackages.filter((pkg) => dealIds.has(pkg.DealId)),
    projects,
    source: portfolio.source,
  };
}

export {
  readMeetingsForOpportunity,
  resolveOpportunityId,
} from "@/lib/meeting-intelligence-data";

export {
  readEmailsForOpportunity,
  buildEmailThreadSummary,
  markEmailDeletedInSource,
  purgeEmailFromSmartCrm,
} from "@/lib/email-intelligence-data";
