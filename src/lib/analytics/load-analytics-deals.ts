import type { OpportunityStage, OpportunityStatus } from "@/generated/prisma";
import {
  pipelineRowToAnalyticsDeal,
  type AnalyticsDeal,
  type AnalyticsDealOutcome,
} from "@/lib/analytics/pipeline-analytics";
import { withPrismaRetry } from "@/lib/prisma";
import { mapPrismaOpportunityToPipelineRow } from "@/lib/prisma-mappers";
import { readPipelines } from "@/lib/pipeline-db";

function mapOutcome(
  status: OpportunityStatus,
  stage: OpportunityStage,
): AnalyticsDealOutcome {
  if (status === "closed_won" || stage === "closed_won") return "won";
  if (status === "closed_lost" || stage === "closed_lost") return "lost";
  if (status === "archived") return "other";
  return "open";
}

function stageLabel(stage: OpportunityStage, status: OpportunityStatus): string {
  if (status === "closed_won" || stage === "closed_won") return "Won";
  if (status === "closed_lost" || stage === "closed_lost") return "Closed Lost";
  const labels: Record<OpportunityStage, string> = {
    prospecting: "Prospecting",
    qualification: "Prospecting",
    discovery: "Feedstock Analysis",
    proposal: "Contract Negotiation",
    negotiation: "Contract Negotiation",
    commitment: "Won",
    closed_won: "Won",
    closed_lost: "Closed Lost",
  };
  return labels[stage] ?? stage;
}

/**
 * Load deals for analytics — includes open + closed won/lost when Prisma is available.
 */
export async function loadAnalyticsDeals(): Promise<{
  deals: AnalyticsDeal[];
  source: "prisma" | "json";
}> {
  try {
    const opportunities = await withPrismaRetry((prisma) =>
      prisma.opportunity.findMany({
        where: {
          status: { in: ["open", "on_hold", "closed_won", "closed_lost"] },
        },
        include: { company: { select: { id: true, name: true } } },
        orderBy: { updatedAt: "desc" },
      }),
    );

    if (opportunities.length === 0) {
      const pipelines = await readPipelines();
      return {
        deals: pipelines.map(pipelineRowToAnalyticsDeal),
        source: "json",
      };
    }

    const deals: AnalyticsDeal[] = opportunities.map((opportunity) => {
      const pipeline = mapPrismaOpportunityToPipelineRow(opportunity);
      const outcome = mapOutcome(opportunity.status, opportunity.stage);
      const base = pipelineRowToAnalyticsDeal(pipeline);

      return {
        ...base,
        stage: stageLabel(opportunity.stage, opportunity.status),
        outcome,
        createdAt: opportunity.createdAt.toISOString(),
        closedAt:
          outcome === "won" || outcome === "lost"
            ? opportunity.updatedAt.toISOString()
            : null,
        winReason:
          outcome === "won"
            ? opportunity.nextStep?.trim() ||
              opportunity.description?.trim() ||
              "Closed won"
            : null,
        lossReason:
          outcome === "lost"
            ? opportunity.nextStep?.trim() ||
              opportunity.description?.trim() ||
              "Closed lost — reason not recorded"
            : null,
        ownerId: opportunity.ownerId,
        ownerName: base.ownerName,
      };
    });

    return { deals, source: "prisma" };
  } catch (error) {
    console.warn(
      "[analytics] Falling back to JSON pipelines:",
      error instanceof Error ? error.message : error,
    );
    const pipelines = await readPipelines();
    return {
      deals: pipelines.map(pipelineRowToAnalyticsDeal),
      source: "json",
    };
  }
}
