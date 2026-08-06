/** Workspace Architect types & UI constants — safe for client components. */

import type { WorkspaceFilterIntent } from "@/types/workspace-filters";

export type WorkspaceArchitectAction =
  | "NAVIGATE_FILTER"
  | "CREATE_TASK"
  | "TRIGGER_ALERT"
  | "EXPORT_VIEW"
  | "UNKNOWN";

export type WorkspaceArchitectEntity =
  | "Company"
  | "Opportunity"
  | "Contact"
  | "Task";

export type WorkspaceArchitectContext = {
  userId?: string | number;
  role?: string;
  displayName?: string;
};

export type WorkspaceArchitectCommand = {
  action: WorkspaceArchitectAction;
  targetEntity: WorkspaceArchitectEntity;
  parsedParameters: Record<string, string | number | boolean>;
  humanReadableConfirmation: string;
  /** Client/server navigation target when action is NAVIGATE_FILTER or EXPORT_VIEW */
  href?: string;
  filterIntent?: WorkspaceFilterIntent & { path: string; summary: string };
  taskTitle?: string;
  confidence: number;
};

export type WorkspaceArchitectExecuteResult = {
  command: WorkspaceArchitectCommand;
  executed: boolean;
  result?: {
    href?: string;
    taskId?: string | number;
    activityId?: string;
    downloadHint?: string;
    message: string;
  };
  error?: string;
};

export const WORKSPACE_ARCHITECT_QUICK_ACTIONS = [
  {
    id: "companies-attention",
    label: "Companies needing attention",
    commandText: "Show companies needing attention",
  },
  {
    id: "high-value-opps",
    label: "High-value opportunities",
    commandText: "Show high value opportunities",
  },
  {
    id: "create-followup",
    label: "Create follow-up task",
    commandText: "Create a task to follow up with primary contact",
  },
  {
    id: "norway-accounts",
    label: "Accounts in Norway",
    commandText: "Show companies in Norway",
  },
  {
    id: "overdue-activities",
    label: "Overdue activities",
    commandText: "Show overdue activities",
  },
] as const;
