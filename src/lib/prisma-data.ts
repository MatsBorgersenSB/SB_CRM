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
 * JSON seed (Nordic Polymers, …) is for local/CI only.
 * Live production must never mask a Prisma failure with demo companies.
 */
export function shouldFallbackToJsonPortfolio(): boolean {
  const registryConfigured = Boolean(
    process.env.DATABASE_URL || process.env.DIRECT_URL,
  );
  const isBuildOrCi =
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.CI === "true";
  if (registryConfigured && process.env.NODE_ENV === "production" && !isBuildOrCi) {
    return false;
  }
  return true;
}

/**
 * Load Companies (with Contacts) and Opportunities from PostgreSQL via Prisma.
 * Falls back to the local JSON store if Prisma is unavailable — except in live production.
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
      if (!shouldFallbackToJsonPortfolio()) {
        console.warn(
          "[prisma-data] Prisma registry empty in production — returning empty portfolio (no JSON fallback)",
        );
        return { companies: [], pipelines: [], source: "prisma" };
      }

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

    if (!shouldFallbackToJsonPortfolio()) {
      console.error(
        `[prisma-data] Prisma query failed in production — not using JSON seed${hint}:`,
        error instanceof Error ? error.message : error,
      );
      throw error;
    }

    console.error(
      `[prisma-data] Falling back to JSON portfolio${hint}:`,
      error instanceof Error ? error.message : error,
    );
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
