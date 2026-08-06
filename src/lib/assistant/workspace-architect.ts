/**
 * Conversational Workspace Architect — NL → structured workspace actions.
 * Reality First: only navigate/filter/create from parsed intent; never invent entities.
 */

import { createActivity } from "@/lib/pipeline-db";
import {
  buildFilterUrl,
  parseFilterIntentFromNaturalLanguage,
} from "@/lib/workspace-filter-bridge";
import type {
  WorkspaceArchitectAction,
  WorkspaceArchitectCommand,
  WorkspaceArchitectContext,
  WorkspaceArchitectEntity,
  WorkspaceArchitectExecuteResult,
} from "@/lib/assistant/workspace-architect-types";
import type { WorkspaceFilterIntent } from "@/types/workspace-filters";

export type {
  WorkspaceArchitectAction,
  WorkspaceArchitectCommand,
  WorkspaceArchitectContext,
  WorkspaceArchitectEntity,
  WorkspaceArchitectExecuteResult,
} from "@/lib/assistant/workspace-architect-types";
export { WORKSPACE_ARCHITECT_QUICK_ACTIONS } from "@/lib/assistant/workspace-architect-types";

const COUNTRY_ALIASES: Array<{ code: string; patterns: RegExp[] }> = [
  { code: "Norway", patterns: [/\bnorway\b|\bnorwegian\b|\bnorge\b/i] },
  { code: "Sweden", patterns: [/\bsweden\b|\bswedish\b|\bsverige\b/i] },
  { code: "Denmark", patterns: [/\bdenmark\b|\bdanish\b|\bdanmark\b/i] },
  { code: "Finland", patterns: [/\bfinland\b|\bfinnish\b|\bsuomi\b/i] },
  { code: "Germany", patterns: [/\bgermany\b|\bgerman\b|\bdeutschland\b/i] },
  { code: "France", patterns: [/\bfrance\b|\bfrench\b/i] },
  { code: "United Kingdom", patterns: [/\bunited kingdom\b|\buk\b|\bbritain\b/i] },
];

function extractCountry(text: string): string | undefined {
  for (const entry of COUNTRY_ALIASES) {
    if (entry.patterns.some((pattern) => pattern.test(text))) return entry.code;
  }
  return undefined;
}

function extractMinValue(text: string): number | undefined {
  const euroMatch = text.match(
    /(?:value|worth|above|over|>|>=|min(?:imum)?)\s*(?:of\s*)?(?:€|eur|\$)?\s*([\d.,]+)\s*(k|m|million|thousand)?/i,
  );
  const bareMatch = text.match(
    /(?:€|eur|\$)\s*([\d.,]+)\s*(k|m|million|thousand)?/i,
  );
  const match = euroMatch ?? bareMatch;
  if (!match) return undefined;
  const raw = Number(match[1]!.replace(/,/g, ""));
  if (!Number.isFinite(raw)) return undefined;
  const unit = (match[2] ?? "").toLowerCase();
  if (unit === "m" || unit === "million") return Math.round(raw * 1_000_000);
  if (unit === "k" || unit === "thousand") return Math.round(raw * 1_000);
  return Math.round(raw);
}

function extractHealthThreshold(text: string): string | undefined {
  const gt = text.match(/health(?:\s*score)?\s*(?:>|>=|above|over)\s*(\d{1,3})/i);
  if (gt) return `>${gt[1]}`;
  const lt = text.match(/health(?:\s*score)?\s*(?:<|<=|below|under)\s*(\d{1,3})/i);
  if (lt) return `<${lt[1]}`;
  if (/\bhealthy\b/i.test(text)) return "healthy";
  if (/\bweak\s+health\b|\bunhealthy\b/i.test(text)) return "weak";
  return undefined;
}

function extractTaskTitle(text: string): string {
  const quoted = text.match(/["“](.+?)["”]/);
  if (quoted?.[1]) return quoted[1].trim();

  const createMatch = text.match(
    /(?:create|add|new)\s+(?:a\s+)?(?:task|todo|follow[- ]?up)\s+(?:to\s+|for\s+|called\s+|titled\s+)?(.+)/i,
  );
  if (createMatch?.[1]) {
    return createMatch[1]
      .replace(/\s+for\s+(?:me|us|mats).*$/i, "")
      .trim()
      .slice(0, 180);
  }

  const follow = text.match(/follow[- ]?up\s+(?:with\s+|on\s+)?(.+)/i);
  if (follow?.[1]) return `Follow up: ${follow[1].trim().slice(0, 160)}`;

  return "Follow-up task";
}

function extractAlertSubject(text: string): string {
  const match = text.match(
    /(?:alert|notify|watch|flag)\s+(?:me\s+)?(?:when\s+|if\s+|about\s+)?(.+)/i,
  );
  return match?.[1]?.trim().slice(0, 160) || "Workspace attention alert";
}

/**
 * Interpret natural language into a structured workspace action.
 */
export async function parseWorkspaceCommand(
  commandText: string,
  context?: WorkspaceArchitectContext,
): Promise<WorkspaceArchitectCommand> {
  const text = commandText.replace(/\s+/g, " ").trim();
  if (!text) {
    return {
      action: "UNKNOWN",
      targetEntity: "Company",
      parsedParameters: {},
      humanReadableConfirmation:
        "No command provided. Try: “Show companies in Norway needing attention”.",
      confidence: 0,
    };
  }

  const lower = text.toLowerCase();
  const country = extractCountry(text);
  const minValue = extractMinValue(text);
  const healthScore = extractHealthThreshold(text);
  const roleHint = context?.role;

  // CREATE_TASK
  if (
    /\b(create|add|new)\s+(a\s+)?(task|todo|follow[- ]?up)\b/i.test(text) ||
    /\bfollow[- ]?up\s+task\b/i.test(text)
  ) {
    const title = extractTaskTitle(text);
    return {
      action: "CREATE_TASK",
      targetEntity: "Task",
      parsedParameters: {
        title,
        ...(roleHint ? { role: roleHint } : {}),
        ...(context?.userId != null ? { userId: String(context.userId) } : {}),
      },
      taskTitle: title,
      humanReadableConfirmation: `Create an open Task activity titled “${title}”.`,
      href: "/activities?view=mine",
      confidence: 0.86,
    };
  }

  // TRIGGER_ALERT
  if (
    /\b(alert|notify|watch|flag)\b/i.test(text) &&
    /\b(when|if|about|me|attention|risk)\b/i.test(text)
  ) {
    const subject = extractAlertSubject(text);
    const params: Record<string, string | number | boolean> = {
      alertSubject: subject,
      view: "needs_attention",
    };
    if (country) params.country = country;
    return {
      action: "TRIGGER_ALERT",
      targetEntity: /\bdeal|opportunit/i.test(text) ? "Opportunity" : "Company",
      parsedParameters: params,
      href: /\bdeal|opportunit/i.test(text)
        ? "/opportunities?view=needs_attention"
        : "/companies?view=needs_attention",
      humanReadableConfirmation: `Open the attention view and flag: “${subject}”.`,
      confidence: 0.72,
    };
  }

  // EXPORT_VIEW
  if (/\b(export|download|csv|excel|spreadsheet)\b/i.test(text)) {
    const entity: WorkspaceArchitectEntity = /\bcontact/i.test(text)
      ? "Contact"
      : /\b(deal|opportunit)/i.test(text)
        ? "Opportunity"
        : /\btask|activit/i.test(text)
          ? "Task"
          : "Company";
    const href =
      entity === "Opportunity"
        ? "/opportunities"
        : entity === "Contact"
          ? "/contacts"
          : entity === "Task"
            ? "/activities"
            : "/companies";
    return {
      action: "EXPORT_VIEW",
      targetEntity: entity,
      parsedParameters: { format: "csv", href },
      href,
      humanReadableConfirmation: `Open the ${entity} workspace so you can export the current view.`,
      confidence: 0.7,
    };
  }

  // NAVIGATE_FILTER — reuse bridge rules + parameter enrichment
  const filterIntent = parseFilterIntentFromNaturalLanguage(text);
  const params: Record<string, string | number | boolean> = {};
  if (country) params.country = country;
  if (healthScore) params.healthScore = healthScore;
  if (minValue != null) params.minValue = minValue;

  if (filterIntent) {
    const filters = { ...filterIntent.filters };
    if (healthScore === "healthy" || healthScore === "weak") {
      filters.health = healthScore;
      filters.view = filters.view ?? healthScore;
    }
    if (minValue != null && filterIntent.workspace === "opportunities") {
      filters.view = filters.view ?? "high_value";
      params.view = "high_value";
    }
    if (country) {
      params.q = country;
    }

    const intent: WorkspaceFilterIntent & { path: string; summary: string } = {
      ...filterIntent,
      filters,
      search: country ?? filterIntent.search,
    };
    const href = buildFilterUrl(intent.path, intent);

    return {
      action: "NAVIGATE_FILTER",
      targetEntity:
        intent.workspace === "opportunities" || intent.workspace === "cvm"
          ? "Opportunity"
          : intent.workspace === "activities"
            ? "Task"
            : intent.workspace === "contacts"
              ? "Contact"
              : "Company",
      parsedParameters: {
        ...params,
        workspace: intent.workspace,
        path: intent.path,
        ...Object.fromEntries(
          Object.entries(intent.filters).map(([key, value]) => [
            key,
            Array.isArray(value) ? value.join(",") : value,
          ]),
        ),
      },
      filterIntent: intent,
      href,
      humanReadableConfirmation: `${intent.summary}${
        country ? ` Scoped search: ${country}.` : ""
      }${minValue != null ? ` Min value: ${minValue.toLocaleString()}.` : ""}`,
      confidence: 0.9,
    };
  }

  // Heuristic navigate without named bridge rule
  if (/\b(show|list|find|filter|open)\b/i.test(lower)) {
    const isOpp = /\b(deal|opportunit|pipeline)\b/i.test(lower);
    const isContact = /\bcontact|people|buyer\b/i.test(lower);
    const isTask = /\b(task|activit|follow[- ]?up)\b/i.test(lower);
    const needsAttention = /\b(attention|at[- ]?risk|stalled|overdue)\b/i.test(
      lower,
    );
    const highValue =
      minValue != null || /\bhigh[- ]?value|large\b/i.test(lower);

    if (isOpp) {
      const view = needsAttention
        ? "needs_attention"
        : highValue
          ? "high_value"
          : "my_opportunities";
      const intent: WorkspaceFilterIntent & { path: string; summary: string } = {
        workspace: "opportunities",
        path: "/opportunities",
        filters: { view },
        search: country,
        summary: `Opening opportunities (${view.replace(/_/g, " ")}).`,
      };
      return {
        action: "NAVIGATE_FILTER",
        targetEntity: "Opportunity",
        parsedParameters: {
          view,
          ...(country ? { country } : {}),
          ...(minValue != null ? { minValue } : {}),
        },
        filterIntent: intent,
        href: buildFilterUrl(intent.path, intent),
        humanReadableConfirmation: intent.summary,
        confidence: 0.75,
      };
    }

    if (isContact) {
      const intent: WorkspaceFilterIntent & { path: string; summary: string } = {
        workspace: "contacts",
        path: "/contacts",
        filters: {},
        search: country,
        summary: "Opening contacts.",
      };
      return {
        action: "NAVIGATE_FILTER",
        targetEntity: "Contact",
        parsedParameters: { ...(country ? { country } : {}) },
        filterIntent: intent,
        href: buildFilterUrl(intent.path, intent),
        humanReadableConfirmation: intent.summary,
        confidence: 0.7,
      };
    }

    if (isTask) {
      const view = needsAttention || /\boverdue\b/i.test(lower) ? "overdue" : "mine";
      const intent: WorkspaceFilterIntent & { path: string; summary: string } = {
        workspace: "activities",
        path: "/activities",
        filters: { view },
        summary: `Opening activities (${view}).`,
      };
      return {
        action: "NAVIGATE_FILTER",
        targetEntity: "Task",
        parsedParameters: { view },
        filterIntent: intent,
        href: buildFilterUrl(intent.path, intent),
        humanReadableConfirmation: intent.summary,
        confidence: 0.72,
      };
    }

    const view = needsAttention
      ? "needs_attention"
      : healthScore === "healthy"
        ? "healthy"
        : healthScore === "weak"
          ? "weak"
          : "all";
    const intent: WorkspaceFilterIntent & { path: string; summary: string } = {
      workspace: "companies",
      path: "/companies",
      filters: {
        view,
        ...(healthScore === "healthy" || healthScore === "weak"
          ? { health: healthScore }
          : {}),
      },
      search: country,
      summary: `Opening companies (${view.replace(/_/g, " ")}).`,
    };
    return {
      action: "NAVIGATE_FILTER",
      targetEntity: "Company",
      parsedParameters: {
        view,
        ...(country ? { country } : {}),
        ...(healthScore ? { healthScore } : {}),
      },
      filterIntent: intent,
      href: buildFilterUrl(intent.path, intent),
      humanReadableConfirmation: intent.summary,
      confidence: 0.74,
    };
  }

  return {
    action: "UNKNOWN",
    targetEntity: "Company",
    parsedParameters: { raw: text },
    humanReadableConfirmation:
      "I couldn’t map that to a workspace action. Try “Show high-value opportunities”, “Create a task to follow up”, or “Companies needing attention”.",
    confidence: 0.2,
  };
}

/**
 * Execute a parsed command (server-side): create tasks, resolve navigation.
 */
export async function executeWorkspaceCommand(
  commandText: string,
  context?: WorkspaceArchitectContext,
): Promise<WorkspaceArchitectExecuteResult> {
  const command = await parseWorkspaceCommand(commandText, context);

  if (command.action === "UNKNOWN") {
    return {
      command,
      executed: false,
      result: { message: command.humanReadableConfirmation },
    };
  }

  if (command.action === "CREATE_TASK") {
    try {
      const title = command.taskTitle || "Follow-up task";
      const activity = await createActivity({
        ActivityType: "Task",
        ActivityDate: new Date().toISOString(),
        Subject: title.slice(0, 180),
        ActivityDescription: title,
        Summary: title,
        ActionRequired: true,
        NextAction: title,
        NextActionDate: "",
        ActionStatus: "Open",
        ActionOutcome: "",
        ActivityOwner: context?.displayName
          ? { Id: Number(context.userId) || 1, Title: context.displayName }
          : null,
      });
      return {
        command,
        executed: true,
        result: {
          href: "/activities?view=mine",
          taskId: activity.id,
          activityId: activity.ActivityID,
          message: `Created task “${title}”.`,
        },
      };
    } catch (error) {
      return {
        command,
        executed: false,
        error:
          error instanceof Error ? error.message : "Could not create task",
        result: { message: "Task creation failed." },
      };
    }
  }

  if (command.action === "NAVIGATE_FILTER" || command.action === "TRIGGER_ALERT") {
    return {
      command,
      executed: true,
      result: {
        href: command.href,
        message: command.humanReadableConfirmation,
      },
    };
  }

  if (command.action === "EXPORT_VIEW") {
    return {
      command,
      executed: true,
      result: {
        href: command.href,
        downloadHint: "Use the workspace export/filter controls after navigation.",
        message: command.humanReadableConfirmation,
      },
    };
  }

  return {
    command,
    executed: false,
    result: { message: command.humanReadableConfirmation },
  };
}


