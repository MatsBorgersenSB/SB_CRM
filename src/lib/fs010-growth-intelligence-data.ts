import { withPrismaRetry } from "@/lib/prisma";
import { prismaDemoSeedCompanyWhere } from "@/lib/demo-seed-markers";
import { isOpportunityEligibleCompany } from "@/lib/company-classification";
import type { Company } from "@/types/company";
import {
  OFFERING_CATEGORIES,
  OFFERING_CATEGORY_LABELS,
  type OfferingCategory,
} from "@/types/offering";
import type {
  AccountHealthIndexView,
  ExpansionSignalView,
  GrowthIntelligenceWorkspaceData,
  WhitespaceMatrixCell,
} from "@/types/fs010-growth-intelligence";

function mapHealth(
  row: {
    id: string;
    companyId: string;
    healthScore: number;
    engagementScore: number;
    sentimentScore: number;
    calculatedAt: Date;
    company: { name: string };
  },
): AccountHealthIndexView {
  return {
    id: row.id,
    companyId: row.companyId,
    companyName: row.company.name,
    healthScore: row.healthScore,
    engagementScore: row.engagementScore,
    sentimentScore: row.sentimentScore,
    calculatedAt: row.calculatedAt.toISOString(),
  };
}

function mapSignal(
  row: {
    id: string;
    companyId: string;
    opportunityId: string | null;
    type: ExpansionSignalView["type"];
    status: ExpansionSignalView["status"];
    title: string;
    observation: string;
    reasoning: string;
    recommendation: string;
    expectedOutcome: string;
    createdAt: Date;
    updatedAt: Date;
    company: { name: string };
    opportunity: { name: string } | null;
  },
): ExpansionSignalView {
  return {
    id: row.id,
    companyId: row.companyId,
    companyName: row.company.name,
    opportunityId: row.opportunityId,
    opportunityName: row.opportunity?.name ?? null,
    type: row.type,
    status: row.status,
    title: row.title,
    observation: row.observation,
    reasoning: row.reasoning,
    recommendation: row.recommendation,
    expectedOutcome: row.expectedOutcome,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function buildWhitespaceMatrix(
  companies: Array<{
    id: string;
    name: string;
    types: string[];
    opportunities: Array<{ id: string; offeringIds?: string[] }>;
  }>,
): WhitespaceMatrixCell[] {
  const cells: WhitespaceMatrixCell[] = [];

  for (const company of companies) {
    if (
      !isOpportunityEligibleCompany({
        CompanyTypes: company.types as Company["CompanyTypes"],
        Status: "Active",
      })
    ) {
      continue;
    }

    const pitchedCategories = new Set<OfferingCategory>();
    for (const opportunity of company.opportunities) {
      const offeringIds = opportunity.offeringIds ?? [];
      if (offeringIds.length === 0 && company.opportunities.length > 0) {
        pitchedCategories.add("system");
      }
      for (const id of offeringIds) {
        if (id.includes("service") || id.includes("maintenance") || id.includes("telemetry")) {
          pitchedCategories.add("service");
        } else if (id.includes("product")) {
          pitchedCategories.add("product");
        } else {
          pitchedCategories.add("system");
        }
      }
    }

    for (const category of OFFERING_CATEGORIES) {
      const coverage = pitchedCategories.has(category)
        ? "pitched"
        : pitchedCategories.size > 0
          ? "unpitched"
          : "unpitched";
      const label = OFFERING_CATEGORY_LABELS[category];
      const isUnpitched = coverage === "unpitched";

      cells.push({
        companyId: company.id,
        companyName: company.name,
        categoryId: category,
        categoryLabel: label,
        coverage,
        observation: isUnpitched
          ? `${label} not represented on open opportunities for ${company.name}.`
          : `${label} already appear on at least one open opportunity for ${company.name}.`,
        reasoning: isUnpitched
          ? "Un-pitched categories are the highest-leverage cross-sell surface once Account Health Index is strong."
          : "Category coverage reduces whitespace; deepen attach rate rather than opening a new lane.",
        recommendation: isUnpitched
          ? `Introduce a ${label.toLowerCase()} conversation on the next account review.`
          : `Validate whether ${label.toLowerCase()} scope can expand on the active deal.`,
        expectedOutcome: isUnpitched
          ? `Converts whitespace into a qualified cross-sell signal for ${company.name}.`
          : `Protects share of wallet inside the existing ${label.toLowerCase()} lane.`,
      });
    }
  }

  return cells;
}

/**
 * Load FS-010 Account Health, Expansion Signals, and Whitespace Matrix from Prisma.
 */
export async function readGrowthIntelligenceWorkspace(): Promise<GrowthIntelligenceWorkspaceData> {
  try {
    const [healthRows, signalRows, companyRows] = await withPrismaRetry((prisma) =>
      Promise.all([
        prisma.accountHealthRecord.findMany({
          where: { company: { NOT: prismaDemoSeedCompanyWhere } },
          include: { company: { select: { name: true } } },
          orderBy: { calculatedAt: "desc" },
        }),
        prisma.expansionSignal.findMany({
          where: { company: { NOT: prismaDemoSeedCompanyWhere } },
          include: {
            company: { select: { name: true } },
            opportunity: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.company.findMany({
          where: { status: "active", NOT: prismaDemoSeedCompanyWhere },
          select: {
            id: true,
            name: true,
            types: true,
            opportunities: {
              where: { status: { in: ["open", "on_hold"] } },
              select: { id: true, offeringIds: true },
            },
          },
          orderBy: { name: "asc" },
        }),
      ]),
    );

    return {
      healthRecords: healthRows.map(mapHealth),
      signals: signalRows.map(mapSignal),
      whitespace: buildWhitespaceMatrix(companyRows),
      source: healthRows.length || signalRows.length ? "prisma" : "empty",
    };
  } catch (error) {
    console.warn(
      "[fs010] Growth workspace load failed:",
      error instanceof Error ? error.message : error,
    );
    return {
      healthRecords: [],
      signals: [],
      whitespace: [],
      source: "empty",
    };
  }
}
