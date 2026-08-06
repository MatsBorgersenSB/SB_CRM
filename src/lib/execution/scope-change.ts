/**
 * Technical Design Freeze & Scope Change Logger
 * Reality First: ECOs are user-logged; Decision Journal sync records the same facts — never invents scope.
 */

import { withPrismaRetry } from "@/lib/prisma";
import type {
  ScopeChangeRecord,
  ScopeChangeRequestSource,
  ScopeChangeStatus,
  ScopeChangeSummary,
} from "@/lib/execution/scope-change-types";

export type {
  ScopeChangeRecord,
  ScopeChangeRequestSource,
  ScopeChangeStatus,
  ScopeChangeSummary,
} from "@/lib/execution/scope-change-types";
export {
  SCOPE_REQUEST_SOURCE_LABELS,
  SCOPE_REQUEST_SOURCE_OPTIONS,
  SCOPE_STATUS_LABELS,
} from "@/lib/execution/scope-change-types";

export type LogEngineeringChangeOrderPayload = {
  projectId: string;
  changeTitle: string;
  requestedBy: ScopeChangeRequestSource | string;
  description: string;
  costImpactEur: number;
  scheduleImpactDays: number;
  status?: ScopeChangeStatus;
  approvedBy?: string | null;
};

const COST_RISK_THRESHOLD_EUR = 10_000;
const SCHEDULE_RISK_THRESHOLD_DAYS = 7;

type PrismaScopeRow = {
  id: string;
  projectId: string;
  decisionJournalId: string | null;
  changeTitle: string;
  requestedBy: string;
  description: string;
  costImpactEur: number;
  scheduleImpactDays: number;
  status: ScopeChangeStatus;
  approvedBy: string | null;
  createdAt: Date;
};

function mapScopeChange(row: PrismaScopeRow): ScopeChangeRecord {
  return {
    id: row.id,
    projectId: row.projectId,
    decisionJournalId: row.decisionJournalId,
    changeTitle: row.changeTitle,
    requestedBy: row.requestedBy,
    description: row.description,
    costImpactEur: row.costImpactEur,
    scheduleImpactDays: row.scheduleImpactDays,
    status: row.status,
    approvedBy: row.approvedBy,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Log an Engineering Change Order (ECO), sync Decision Journal, and escalate health when material.
 */
export async function logEngineeringChangeOrder(
  payload: LogEngineeringChangeOrderPayload,
): Promise<{ scopeChange: ScopeChangeRecord; decisionJournalId: string }> {
  const changeTitle = payload.changeTitle.trim();
  const description = payload.description.trim();
  const requestedBy = String(payload.requestedBy ?? "").trim();

  if (!changeTitle) throw new Error("changeTitle is required");
  if (!description) throw new Error("description is required");
  if (!requestedBy) throw new Error("requestedBy is required");
  if (!Number.isFinite(payload.costImpactEur)) {
    throw new Error("costImpactEur must be a number");
  }
  if (!Number.isFinite(payload.scheduleImpactDays)) {
    throw new Error("scheduleImpactDays must be a number");
  }

  const project = await withPrismaRetry((prisma) =>
    prisma.project.findUnique({ where: { id: payload.projectId } }),
  );
  if (!project) throw new Error("Project not found");

  const materialImpact =
    Math.abs(payload.costImpactEur) > COST_RISK_THRESHOLD_EUR ||
    Math.abs(payload.scheduleImpactDays) > SCHEDULE_RISK_THRESHOLD_DAYS;

  const status: ScopeChangeStatus = payload.status ?? "PROPOSED";

  const result = await withPrismaRetry((prisma) =>
    prisma.$transaction(async (tx) => {
      const journal = await tx.decisionJournal.create({
        data: {
          companyId: project.companyId,
          opportunityId: project.opportunityId,
          decisionText: changeTitle,
          rationale: description,
          category: "Technical",
          confidenceScore: 0.9,
          sourceSnippet: `ECO · ${requestedBy} · €${payload.costImpactEur} · ${payload.scheduleImpactDays}d`,
          stakeholderName: payload.approvedBy?.trim() || null,
        },
      });

      const scopeChange = await tx.projectScopeChange.create({
        data: {
          projectId: payload.projectId,
          decisionJournalId: journal.id,
          changeTitle,
          requestedBy,
          description,
          costImpactEur: payload.costImpactEur,
          scheduleImpactDays: Math.round(payload.scheduleImpactDays),
          status,
          approvedBy: payload.approvedBy?.trim() || null,
        },
      });

      if (materialImpact) {
        await tx.project.update({
          where: { id: payload.projectId },
          data: { healthStatus: "AT_RISK" },
        });
      }

      return { scopeChange, decisionJournalId: journal.id };
    }),
  );

  return {
    scopeChange: mapScopeChange(result.scopeChange as PrismaScopeRow),
    decisionJournalId: result.decisionJournalId,
  };
}

export async function listProjectScopeChanges(
  projectId: string,
): Promise<ScopeChangeSummary> {
  const project = await withPrismaRetry((prisma) =>
    prisma.project.findUnique({ where: { id: projectId } }),
  );
  if (!project) throw new Error("Project not found");

  const rows = await withPrismaRetry((prisma) =>
    prisma.projectScopeChange.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    }),
  );

  const changes = (rows as PrismaScopeRow[]).map(mapScopeChange);
  const active = changes.filter((c) => c.status !== "REJECTED");

  return {
    projectId: project.id,
    projectTitle: project.title,
    changes,
    cumulativeCostImpactEur: active.reduce((sum, c) => sum + c.costImpactEur, 0),
    cumulativeScheduleImpactDays: active.reduce(
      (sum, c) => sum + c.scheduleImpactDays,
      0,
    ),
    openProposedCount: changes.filter((c) => c.status === "PROPOSED").length,
  };
}
