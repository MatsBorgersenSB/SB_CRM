import { withPrismaRetry } from "@/lib/prisma";
import type {
  WorkflowApprovalQueueData,
  WorkflowExecutionView,
} from "@/types/fs011-workflows";

function readExplainability(payload: unknown): {
  title: string;
  observation: string;
  reasoning: string;
  recommendation: string;
  expectedOutcome: string;
} {
  const data =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};
  return {
    title: typeof data.title === "string" ? data.title : "Workflow proposal",
    observation: typeof data.observation === "string" ? data.observation : "",
    reasoning: typeof data.reasoning === "string" ? data.reasoning : "",
    recommendation:
      typeof data.recommendation === "string" ? data.recommendation : "",
    expectedOutcome:
      typeof data.expectedOutcome === "string" ? data.expectedOutcome : "",
  };
}

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Load FS-011 approval queue + summary metrics from Prisma.
 */
export async function readWorkflowApprovalQueue(): Promise<WorkflowApprovalQueueData> {
  try {
    const rows = await withPrismaRetry((prisma) =>
      prisma.workflowExecution.findMany({
        include: {
          rule: { select: { name: true, triggerType: true } },
          company: { select: { name: true } },
          opportunity: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    );

    const executions: WorkflowExecutionView[] = rows.map((row) => {
      const explain = readExplainability(row.payload);
      return {
        id: row.id,
        ruleId: row.ruleId,
        ruleName: row.rule.name,
        triggerType: row.rule.triggerType,
        opportunityId: row.opportunityId,
        opportunityName: row.opportunity?.name ?? null,
        companyId: row.companyId,
        companyName: row.company?.name ?? null,
        actionType: row.actionType,
        status: row.status,
        title: explain.title,
        observation: explain.observation,
        reasoning: explain.reasoning,
        recommendation: explain.recommendation,
        expectedOutcome: explain.expectedOutcome,
        executedAt: row.executedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      };
    });

    const pendingApprovals = executions.filter(
      (item) => item.status === "pending_approval",
    ).length;
    const today = startOfTodayUtc();
    const executedToday = executions.filter((item) => {
      if (item.status !== "executed" || !item.executedAt) return false;
      return new Date(item.executedAt) >= today;
    }).length;

    // Advisory metric: ~12 min saved per drafted/tasked execution (pending + executed).
    const timeSavedMinutes =
      (pendingApprovals + executions.filter((e) => e.status === "executed").length) * 12;

    return {
      executions,
      metrics: {
        pendingApprovals,
        executedToday,
        timeSavedMinutes,
      },
      source: executions.length ? "prisma" : "empty",
    };
  } catch (error) {
    console.warn(
      "[fs011] Approval queue load failed:",
      error instanceof Error ? error.message : error,
    );
    return {
      executions: [],
      metrics: { pendingApprovals: 0, executedToday: 0, timeSavedMinutes: 0 },
      source: "empty",
    };
  }
}
