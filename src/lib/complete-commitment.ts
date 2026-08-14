/**
 * In-place commitment complete / reschedule — FS-013.
 * SmartAssist prepares the card; the user decides.
 */

import type { Activity, UpdateActivityInput } from "@/types/activity";
import {
  isFollowUpOpen,
  isFollowUpOverdue,
} from "@/lib/activity-utils";

export type CompleteCommitmentMode = "complete" | "reschedule";

export type CompleteCommitmentRequest = {
  /** Activity tracking id (ACT-…) or numeric id. */
  activityId?: string;
  /** Alias accepted from clients that speak in commitment terms. */
  commitmentId?: string;
  outcomeNote?: string;
  /** Ignored on the server — session / audit actor wins. */
  userId?: string;
  mode?: CompleteCommitmentMode;
  /** ISO date (YYYY-MM-DD) required when mode is reschedule. */
  nextActionDate?: string;
};

export type PendingCommitmentView = {
  activityId: string;
  title: string;
  dueDate: string;
  overdue: boolean;
};

export function resolveCommitmentActivityId(
  input: Pick<CompleteCommitmentRequest, "activityId" | "commitmentId">,
): string {
  return (input.activityId ?? input.commitmentId ?? "").trim();
}

export function isDueDateOverdue(dueDate: string, now = new Date()): boolean {
  if (!dueDate.trim()) return false;
  const raw = dueDate.includes("T") ? dueDate : `${dueDate}T00:00:00`;
  const due = new Date(raw);
  if (Number.isNaN(due.getTime())) return false;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  return dueDay < today;
}

export function toPendingCommitmentView(activity: Activity): PendingCommitmentView {
  const title = (activity.NextAction || activity.Subject).trim() || "Open commitment";
  return {
    activityId: activity.ActivityID,
    title,
    dueDate: activity.NextActionDate,
    overdue: isFollowUpOverdue(activity),
  };
}

/** Overdue first, then soonest due date. One card — Michelin. */
export function pickPendingCommitment(activities: Activity[]): Activity | null {
  const open = activities.filter(isFollowUpOpen);
  if (open.length === 0) return null;

  return [...open].sort((a, b) => {
    const aOverdue = isFollowUpOverdue(a) ? 0 : 1;
    const bOverdue = isFollowUpOverdue(b) ? 0 : 1;
    if (aOverdue !== bOverdue) return aOverdue - bOverdue;
    return (a.NextActionDate || "9999").localeCompare(b.NextActionDate || "9999");
  })[0] ?? null;
}

export function appendOutcomeNote(
  existing: Activity,
  note: string,
  actorLabel?: string,
): string {
  const trimmed = note.trim();
  if (!trimmed) return existing.ActivityDescription ?? "";
  const stamp = new Date().toISOString().slice(0, 10);
  const who = actorLabel?.trim() ? ` · ${actorLabel.trim()}` : "";
  const line = `${stamp}${who}: ${trimmed}`;
  const prior = (existing.ActivityDescription ?? "").trim();
  return prior ? `${prior}\n${line}` : line;
}

export function buildCompleteCommitmentPatch(
  existing: Activity,
  input: {
    mode: CompleteCommitmentMode;
    outcomeNote?: string;
    nextActionDate?: string;
    actorLabel?: string;
  },
): UpdateActivityInput {
  const note = input.outcomeNote?.trim() ?? "";
  const description = note
    ? appendOutcomeNote(existing, note, input.actorLabel)
    : existing.ActivityDescription;

  if (input.mode === "reschedule") {
    const nextDate = (input.nextActionDate ?? "").trim();
    return {
      NextActionDate: nextDate,
      ActionRequired: true,
      ...(note ? { ActivityDescription: description } : {}),
    };
  }

  const nextAction = existing.NextAction?.trim() ?? "";
  const agreed = (existing.AgreedActions ?? []).map((action) => {
    if (action.status === "Completed" || action.status === "Cancelled") return action;
    if (nextAction && action.text.trim() === nextAction) {
      return { ...action, status: "Completed" as const };
    }
    return action;
  });

  return {
    ActionStatus: "Completed",
    ActionRequired: false,
    ActivityDescription: description,
    ...(note && !existing.Summary?.trim() ? { Summary: note } : {}),
    ...(agreed.length > 0 ? { AgreedActions: agreed } : {}),
  };
}
