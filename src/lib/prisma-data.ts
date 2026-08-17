import "server-only";

import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type { Activity } from "@/types/activity";
import type { CommercialPackage } from "@/types/commercial-package";
import type { Project } from "@/types/project";
import { filterActivitiesToLiveEntities } from "@/lib/activity-utils";
import { isPrismaConnectionError, withPrismaRetry } from "@/lib/prisma";
import { classifyByFileName } from "@/lib/mock-ai-parser";
import {
  mapPrismaCompanyToApp,
  mapPrismaOpportunityToPipelineRow,
  stableNumericId,
  toCompanyTrackingId,
} from "@/lib/prisma-mappers";
import type { SmartDocLibraryRecord } from "@/types/smartdoc-library";
import { SMARTDOC_CATEGORIES, type SmartDocCategory } from "@/types/smartdoc-library";
import { emptyAnalytics, type AnalyticsDb } from "@/lib/analytics-data";
import { emptyInventory, type InventoryDb } from "@/lib/inventory-data";
import {
  readActivities as readJsonActivities,
  readAnalytics as readJsonAnalytics,
  readCommercialPackages as readJsonCommercialPackages,
  readCompanies as readJsonCompanies,
  readInventory as readJsonInventory,
  readOutlookEvidence as readJsonOutlookEvidence,
  readPipelines as readJsonPipelines,
  readResearchReports as readJsonResearchReports,
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
 * JSON seed (Nordic Polymers, Circular Textiles, …) is for local/CI only.
 * Live production — including `next build` on Vercel — must never mask Prisma
 * with demo opportunities or companies.
 */
export function shouldFallbackToJsonPortfolio(): boolean {
  const registryConfigured = Boolean(
    process.env.DATABASE_URL || process.env.DIRECT_URL,
  );
  if (registryConfigured && process.env.NODE_ENV === "production") {
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

function displayNameFromFile(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "").trim() || fileName;
}

function toSmartDocCategory(value: string): SmartDocCategory {
  return SMARTDOC_CATEGORIES.includes(value as SmartDocCategory)
    ? (value as SmartDocCategory)
    : "General";
}

/**
 * Live SmartDocs from Prisma DocumentRecord.
 * JSON seed library (Nordic Polymers Thermal Recovery…) is local/CI only.
 */
export async function readLiveSmartDocsLibrary(): Promise<SmartDocLibraryRecord[]> {
  try {
    const records = await withPrismaRetry((prisma) =>
      prisma.documentRecord.findMany({
        include: {
          company: { select: { id: true, name: true, code: true } },
          opportunity: {
            select: {
              id: true,
              name: true,
              code: true,
              company: { select: { id: true, name: true, code: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
    );

    if (records.length === 0) {
      if (!shouldFallbackToJsonPortfolio()) return [];
      const { readSmartDocsLibrary } = await import("@/lib/pipeline-db");
      return readSmartDocsLibrary();
    }

    return records.map((row) => {
      const owner = row.company ?? row.opportunity?.company ?? null;
      const classified = classifyByFileName(row.name);
      const companyId = owner
        ? owner.code?.trim() || toCompanyTrackingId(owner.id)
        : undefined;

      return {
        id: stableNumericId(row.id),
        SmartDocID: row.id,
        DealId: row.opportunityId,
        OwnerCompanyId: companyId,
        Ownership: row.opportunityId
          ? "opportunity"
          : row.companyId
            ? "company"
            : undefined,
        PlNumber:
          row.opportunity?.code?.trim() ||
          owner?.code?.trim() ||
          companyId ||
          "",
        ClientName: owner?.name ?? "",
        DealName: row.opportunity?.name ?? "",
        CommercialStage: "",
        CreatedAt: row.createdAt.toISOString(),
        DocCategory: toSmartDocCategory(classified.DocCategory),
        DocType: classified.DocType,
        DocumentName: displayNameFromFile(row.name),
        Revision: "01",
        FileLeafRef: row.name,
        Origin: classified.Origin,
        Counterparty: classified.Counterparty,
        SharePointWebUrl: row.sharepointWebUrl ?? undefined,
        LinkedDealId: row.opportunityId,
      } satisfies SmartDocLibraryRecord;
    });
  } catch (error) {
    if (!shouldFallbackToJsonPortfolio()) {
      console.error(
        "[prisma-data] SmartDocs query failed in production — not using JSON seed:",
        error instanceof Error ? error.message : error,
      );
      throw error;
    }
    const { readSmartDocsLibrary } = await import("@/lib/pipeline-db");
    return readSmartDocsLibrary();
  }
}

/** Activities remain on the JSON store until modeled in Prisma — pruned to live entities. */
export async function readLiveActivities() {
  const activities = await readJsonActivities();
  if (shouldFallbackToJsonPortfolio()) return activities;

  const [portfolio, projects] = await Promise.all([
    readLivePortfolio(),
    readProjects().catch(() => [] as Project[]),
  ]);
  return filterActivitiesToLiveEntities(activities, {
    companies: portfolio.companies,
    pipelines: portfolio.pipelines,
    projectIds: new Set(projects.map((project) => project.id)),
  });
}

export async function getLiveActivityById(activityId: string) {
  const activities = await readLiveActivities();
  return activities.find(
    (activity) =>
      activity.ActivityID === activityId || String(activity.id) === activityId,
  );
}

export async function readLiveCommercialPackages() {
  const packages = await readJsonCommercialPackages();
  if (shouldFallbackToJsonPortfolio()) return packages;

  const portfolio = await readLivePortfolio();
  const dealIds = new Set(portfolio.pipelines.map((pipeline) => pipeline.id));
  return packages.filter((pkg) => dealIds.has(pkg.DealId));
}

export async function readLiveOutlookEvidence() {
  const evidence = await readJsonOutlookEvidence();
  if (shouldFallbackToJsonPortfolio()) return evidence;

  const portfolio = await readLivePortfolio();
  const companyIds = new Set(
    portfolio.companies.flatMap((company) =>
      [company.CompanyID, company.code].filter(
        (value): value is string => Boolean(value?.trim()),
      ),
    ),
  );
  const dealIds = new Set(portfolio.pipelines.map((pipeline) => pipeline.id));

  return evidence.filter((row) => {
    if (row.companyId && companyIds.has(row.companyId)) return true;
    if (row.dealId && dealIds.has(row.dealId)) return true;
    if (row.entityType === "company" && companyIds.has(row.entityId)) return true;
    if (row.entityType === "opportunity" && dealIds.has(row.entityId)) return true;
    return false;
  });
}

export async function readLiveInventory(): Promise<InventoryDb> {
  if (!shouldFallbackToJsonPortfolio()) return emptyInventory;
  return readJsonInventory();
}

export async function readLiveAnalytics(): Promise<AnalyticsDb> {
  if (!shouldFallbackToJsonPortfolio()) return emptyAnalytics;
  return readJsonAnalytics();
}

export async function readLiveResearchReports() {
  if (!shouldFallbackToJsonPortfolio()) return [];
  return readJsonResearchReports();
}

export async function readLiveSmartDocsForDeal(dealId: string) {
  const library = await readLiveSmartDocsLibrary();
  const key = dealId.trim().toLowerCase();
  return library.filter((record) => {
    if (record.DealId?.toLowerCase() === key) return true;
    if (record.LinkedDealId?.toLowerCase() === key) return true;
    if (record.PlNumber?.toLowerCase() === key && record.Ownership !== "company") {
      return true;
    }
    return false;
  });
}

export async function readLiveSmartDocsForCompany(companyId: string) {
  const [library, companies] = await Promise.all([
    readLiveSmartDocsLibrary(),
    readLiveCompanies(),
  ]);
  const key = companyId.trim().toLowerCase();
  const company = companies.find(
    (row) =>
      row.CompanyID.trim().toLowerCase() === key ||
      row.code?.trim().toLowerCase() === key ||
      String(row.id) === companyId.trim(),
  );
  const pipelineIds = new Set(
    (company?.pipelineIds ?? []).map((id) => id.trim().toLowerCase()),
  );

  return library.filter((record) => {
    if (record.OwnerCompanyId?.trim().toLowerCase() === key) return true;
    if (
      company?.CompanyID &&
      record.OwnerCompanyId?.trim().toLowerCase() ===
        company.CompanyID.trim().toLowerCase()
    ) {
      return true;
    }
    if (company?.code && record.PlNumber?.toUpperCase() === company.code.toUpperCase()) {
      return true;
    }
    if (record.DealId && pipelineIds.has(record.DealId.trim().toLowerCase())) {
      return true;
    }
    return false;
  });
}

export async function readLiveSmartDocsForProject(projectId: string) {
  const library = await readLiveSmartDocsLibrary();
  const key = projectId.trim().toLowerCase();
  return library.filter((record) => {
    if (record.LinkedProjectId?.trim().toLowerCase() === key) return true;
    if (
      record.Ownership === "project" &&
      record.PlNumber?.trim().toLowerCase() === key
    ) {
      return true;
    }
    return false;
  });
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
