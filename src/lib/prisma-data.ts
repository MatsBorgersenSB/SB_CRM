import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
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

export type LivePortfolio = {
  companies: Company[];
  pipelines: PipelineRow[];
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
      const [jsonCompanies, jsonPipelines] = await Promise.all([
        readJsonCompanies(),
        readJsonPipelines(),
      ]);
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
