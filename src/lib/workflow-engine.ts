import type { ExecutionStatus, Prisma, WorkflowExecution, WorkflowRule } from "@/generated/prisma";
import {
  createM365DraftEmail,
  generateOutlookDeepLink,
  getActiveM365AccessToken,
} from "@/lib/m365-client";
import { createActivity } from "@/lib/pipeline-db";
import { getPrisma, withPrismaRetry } from "@/lib/prisma";

export type WorkflowExplainabilityPayload = {
  title?: string;
  observation: string;
  reasoning: string;
  recommendation: string;
  expectedOutcome: string;
  action?: Record<string, unknown>;
};

export type WorkflowTriggerContext = {
  companyId?: string | null;
  opportunityId?: string | null;
  signalType?: string | null;
  sentimentGrade?: string | null;
  commitmentId?: string | null;
  /** Optional overrides for the created execution */
  actionType?: string;
  payload?: Partial<WorkflowExplainabilityPayload> & Record<string, unknown>;
};

export type EvaluateWorkflowResult = {
  matchedRules: number;
  createdExecutions: WorkflowExecution[];
};

type RuleConditions = {
  signalTypes?: string[];
  signalType?: string;
  sentimentGrades?: string[];
  actionType?: string;
  minHealthScore?: number;
};

function asConditions(value: unknown): RuleConditions {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as RuleConditions;
}

function asPayload(value: unknown): WorkflowExplainabilityPayload & Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      observation: "",
      reasoning: "",
      recommendation: "",
      expectedOutcome: "",
    };
  }
  return value as WorkflowExplainabilityPayload & Record<string, unknown>;
}

function ruleMatchesContext(rule: WorkflowRule, context: WorkflowTriggerContext): boolean {
  const conditions = asConditions(rule.conditions);

  if (conditions.signalType && context.signalType) {
    if (conditions.signalType !== context.signalType) return false;
  }

  if (conditions.signalTypes?.length && context.signalType) {
    if (!conditions.signalTypes.includes(context.signalType)) return false;
  }

  if (conditions.sentimentGrades?.length && context.sentimentGrade) {
    if (!conditions.sentimentGrades.includes(context.sentimentGrade)) return false;
  }

  return true;
}

function buildDefaultPayload(
  rule: WorkflowRule,
  context: WorkflowTriggerContext,
): WorkflowExplainabilityPayload & Record<string, unknown> {
  const override = context.payload ?? {};
  return {
    title: override.title ?? `Proposed action from ${rule.name}`,
    observation:
      override.observation ??
      `Trigger "${rule.triggerType}" matched active rule "${rule.name}".`,
    reasoning:
      override.reasoning ??
      "Rule conditions matched observed CRM evidence; SmartAssist proposes a next step for user approval.",
    recommendation:
      override.recommendation ??
      "Review the proposed action and Approve & Execute only if commercially appropriate.",
    expectedOutcome:
      override.expectedOutcome ??
      "Approved execution advances the deal or relationship without silent CRM mutation.",
    action: override.action,
    ...override,
  };
}

/**
 * Evaluate active WorkflowRules for a trigger and enqueue pending_approval executions.
 * User Sovereignty: never executes side effects here.
 */
export async function evaluateWorkflowTrigger(
  triggerType: string,
  contextData: WorkflowTriggerContext = {},
): Promise<EvaluateWorkflowResult> {
  return withPrismaRetry(async (prisma) => {
    const rules = await prisma.workflowRule.findMany({
      where: {
        status: "active",
        triggerType,
      },
      orderBy: { createdAt: "asc" },
    });

    const matched = rules.filter((rule) => ruleMatchesContext(rule, contextData));
    const createdExecutions: WorkflowExecution[] = [];

    for (const rule of matched) {
      const conditions = asConditions(rule.conditions);
      const actionType =
        contextData.actionType ||
        conditions.actionType ||
        "create_task";
      const payload = buildDefaultPayload(rule, contextData);

      const execution = await prisma.workflowExecution.create({
        data: {
          ruleId: rule.id,
          companyId: contextData.companyId ?? null,
          opportunityId: contextData.opportunityId ?? null,
          actionType,
          status: "pending_approval",
          payload: payload as Prisma.InputJsonValue,
        },
      });
      createdExecutions.push(execution);
    }

    return {
      matchedRules: matched.length,
      createdExecutions,
    };
  });
}

export type ExecuteWorkflowResult = {
  execution: WorkflowExecution;
  sideEffect?: Record<string, unknown>;
};

/**
 * Approve then execute a pending WorkflowExecution (User Sovereignty gate).
 * Transitions: pending_approval → approved → executed | failed.
 */
export async function executeApprovedWorkflow(
  executionId: string,
): Promise<ExecuteWorkflowResult> {
  const prisma = getPrisma();

  const existing = await prisma.workflowExecution.findUnique({
    where: { id: executionId },
  });
  if (!existing) {
    throw new Error(`WorkflowExecution not found: ${executionId}`);
  }
  if (existing.status === "dismissed") {
    throw new Error("Dismissed executions cannot be executed");
  }
  if (existing.status === "executed") {
    return { execution: existing, sideEffect: { alreadyExecuted: true } };
  }

  const approved = await prisma.workflowExecution.update({
    where: { id: executionId },
    data: { status: "approved" },
  });

  try {
    const sideEffect = await runSideEffect(approved);
    const executed = await prisma.workflowExecution.update({
      where: { id: executionId },
      data: {
        status: "executed",
        executedAt: new Date(),
        payload: {
          ...asPayload(approved.payload),
          executionResult: sideEffect,
        } as Prisma.InputJsonValue,
      },
    });
    return { execution: executed, sideEffect };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown execution error";
    await prisma.workflowExecution.update({
      where: { id: executionId },
      data: {
        status: "failed",
        payload: {
          ...asPayload(approved.payload),
          executionError: message,
        } as Prisma.InputJsonValue,
      },
    });
    throw error;
  }
}

export async function dismissWorkflowExecution(
  executionId: string,
): Promise<WorkflowExecution> {
  return withPrismaRetry((prisma) =>
    prisma.workflowExecution.update({
      where: { id: executionId },
      data: { status: "dismissed" },
    }),
  );
}

async function runSideEffect(
  execution: WorkflowExecution,
): Promise<Record<string, unknown>> {
  const payload = asPayload(execution.payload);
  const action = (payload.action ?? {}) as Record<string, unknown>;

  switch (execution.actionType) {
    case "create_task": {
      const subject =
        (typeof action.subject === "string" && action.subject) ||
        payload.title ||
        "Workflow follow-up";
      const dueInDays =
        typeof action.dueInDays === "number" ? action.dueInDays : 5;
      const due = new Date();
      due.setDate(due.getDate() + dueInDays);

      const activity = await createActivity({
        ActivityType: (typeof action.activityType === "string"
          ? action.activityType
          : "Task") as never,
        ActivityDate: due.toISOString().slice(0, 10),
        Subject: subject,
        ActivityDescription:
          payload.recommendation ||
          "Created by FS-011 Autonomous Workflow Engine after user approval.",
        ActionRequired: true,
        NextAction: payload.recommendation || "Complete workflow follow-up",
        NextActionDate: due.toISOString().slice(0, 10),
        ActionStatus: "Planned",
        ActionOutcome: "",
        Priority: "High",
        Deal: execution.opportunityId
          ? { DealID: execution.opportunityId }
          : null,
        Company: execution.companyId
          ? { CompanyID: execution.companyId }
          : null,
      });

      return {
        type: "create_task",
        activityId: activity.ActivityID,
        subject: activity.Subject,
      };
    }

    case "generate_outlook_draft": {
      const toEmail =
        (typeof action.toEmail === "string" && action.toEmail) ||
        "noreply@example.com";
      const subject =
        (typeof action.subject === "string" && action.subject) ||
        payload.title ||
        "SmartCRM follow-up";
      const bodyHtml =
        (typeof action.bodyHtml === "string" && action.bodyHtml) ||
        `<p>${payload.recommendation}</p>`;

      const active = await getActiveM365AccessToken();
      if (active?.integrationId) {
        const draft = await createM365DraftEmail({
          integrationId: active.integrationId,
          toEmail,
          subject,
          bodyHtml,
        });
        return {
          type: "generate_outlook_draft",
          mode: "graph_draft",
          draftId: draft.draftId,
          webLink: draft.webLink,
        };
      }

      const deepLink = generateOutlookDeepLink({
        toEmail,
        subject,
        body: bodyHtml.replace(/<[^>]+>/g, " "),
      });
      return {
        type: "generate_outlook_draft",
        mode: "deep_link",
        deepLink,
      };
    }

    case "update_stage": {
      const opportunityId =
        (typeof action.opportunityId === "string" && action.opportunityId) ||
        execution.opportunityId;
      if (!opportunityId) {
        throw new Error("update_stage requires opportunityId");
      }

      const probability =
        typeof action.probability === "number" ? action.probability : undefined;
      const stage =
        typeof action.stage === "string" ? action.stage : undefined;

      const prisma = getPrisma();
      const updated = await prisma.opportunity.update({
        where: { id: opportunityId },
        data: {
          ...(probability != null ? { probability } : {}),
          ...(stage
            ? { stage: stage as never }
            : {}),
        },
      });

      return {
        type: "update_stage",
        opportunityId: updated.id,
        probability: updated.probability,
        stage: updated.stage,
      };
    }

    default: {
      return {
        type: execution.actionType,
        note: "No dedicated side-effect handler — marked executed after approval.",
      };
    }
  }
}

export function isTerminalExecutionStatus(status: ExecutionStatus): boolean {
  return status === "executed" || status === "dismissed" || status === "failed";
}
