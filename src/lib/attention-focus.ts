import type { Activity } from "@/types/activity";
import type { AttentionItem, AttentionQueue } from "@/types/attention-item";
import { isFollowUpOpen } from "@/lib/activity-utils";
import {
  flattenAttentionQueue,
  groupAttentionBySeverity,
  sortAttentionItems,
} from "@/types/attention-item";

/**
 * Today decides, it does not list. One row per company (or per object when there is
 * no company) — the most severe, earliest-due item leads. Every count shown on Today
 * is derived from this same set so the numbers can never disagree.
 */
export function dedupeAttentionByCompany(items: AttentionItem[]): AttentionItem[] {
  const picked = new Map<string, AttentionItem>();
  for (const item of sortAttentionItems(items)) {
    const key = item.companyId ?? item.sourceObjectId;
    const current = picked.get(key);
    if (!current) {
      picked.set(key, item);
      continue;
    }
    // A promise we made outranks a suggestion at the same severity.
    if (
      current.severity === item.severity &&
      !isCommitmentItem(current) &&
      isCommitmentItem(item)
    ) {
      picked.set(key, item);
    }
  }
  return sortAttentionItems([...picked.values()]);
}

/** Open follow-ups the user (or a colleague) committed to — not system suggestions. */
export function isCommitmentItem(item: Pick<AttentionItem, "ruleId">): boolean {
  return item.ruleId === "overdue_followup" || item.ruleId === "due_today";
}

export function dedupeQueueByCompany(queue: AttentionQueue): AttentionQueue {
  return groupAttentionBySeverity(
    dedupeAttentionByCompany(flattenAttentionQueue(queue, { includeHealthy: true })),
  );
}

/** Second line under the Today headline — only what the headline does not already say. */
export function attentionSummaryLine(queue: AttentionQueue): string | undefined {
  const urgent = queue.urgent.length;
  const needs = queue.needs_attention.length;
  const waiting = queue.waiting.length;
  const parts: string[] = [];
  const overdue = queue.urgent.filter((row) => row.ruleId === "overdue_followup").length;
  if (overdue > 0) {
    parts.push(`${overdue} ${overdue === 1 ? "is an overdue commitment" : "are overdue commitments"}`);
  }
  if (urgent > 0 && needs > 0) parts.push(`${needs} more need attention soon`);
  if (waiting > 0) parts.push(`${waiting} waiting on others`);
  return parts.length > 0 ? `${parts.join(" · ")}.` : undefined;
}

/**
 * Why this matters — written for the specific situation, not the severity bucket.
 * Reality First: no invented figures, only what the rule actually observed.
 */
export function attentionImpact(
  item: Pick<AttentionItem, "ruleId" | "companyName" | "sourceObjectName" | "severity">,
): string {
  const name = item.companyName?.trim() || item.sourceObjectName;
  switch (item.ruleId) {
    case "stalled_opportunity":
      return `${name} has gone quiet — the longer it stays that way, the harder the deal is to revive.`;
    case "no_recent_contact":
    case "maintain_momentum":
      return `The relationship with ${name} is cooling — it is easier to keep warm than to restart.`;
    case "no_activity":
    case "make_first_contact":
      return `Nothing is recorded with ${name} yet — we cannot qualify or plan until a first conversation happens.`;
    case "missing_stakeholders":
    case "add_primary_contact":
      return `The deal with ${name} rests on too few people — if one steps back, we lose access.`;
    case "overdue_followup":
    case "due_today":
      return `A commitment to ${name} is open — keeping it protects our credibility.`;
    case "incomplete_document_set":
    case "package_not_transmitted":
      return `${name} cannot move forward until the documents are complete and sent.`;
    case "classify_relationship":
      return `Until we know what ${name} is to us, SmartAssist cannot recommend the right next step.`;
    case "supplier_follow_through":
      return `An open commitment with supplier ${name} may hold up delivery if nobody follows through.`;
    case "create_new_opportunity":
      return `${name} has no tracked opportunity — any revenue here is not being managed.`;
    case "risk_threshold_exceeded":
      return `Risk on ${name} has passed the level where it needs your decision.`;
    default:
      return item.severity === "urgent"
        ? `${name} needs a decision now — waiting costs momentum.`
        : `${name} needs attention — it will slow progress if left.`;
  }
}

/** Home budget: how many deduplicated rows show before "Show all". */
export const TODAY_ATTENTION_VISIBLE = 5;
/** Home budget: Active Assist proposals shown at once. */
export const TODAY_PROPOSALS_VISIBLE = 3;

/** One proposal per company, in the order given (already ranked by severity). */
export function dedupeByCompany<T extends { companyId?: string; id: string }>(
  proposals: T[],
): T[] {
  const seen = new Set<string>();
  return proposals.filter((proposal) => {
    const key = proposal.companyId ?? proposal.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDayMs(value: Date): number {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

/**
 * Tasks the user owns that fall due after today but within a week. Today already shows
 * overdue / due-today commitments as Attention rows; this is the quiet "what is coming"
 * count — never a second list. Items already surfaced as rows are excluded.
 */
export function countUpcomingTasks(
  activities: Activity[],
  ownerName: string | undefined,
  surfacedActivityIds: ReadonlySet<string>,
  now: Date = new Date(),
): number {
  const owner = ownerName?.trim().toLowerCase();
  if (!owner) return 0;
  const today = startOfDayMs(now);
  return activities.filter((activity) => {
    if (activity.ActivityType !== "Task" || !isFollowUpOpen(activity)) return false;
    if (activity.ActivityOwner?.Title?.trim().toLowerCase() !== owner) return false;
    if (!activity.NextActionDate) return false;
    if (surfacedActivityIds.has(activity.ActivityID)) return false;
    const due = startOfDayMs(new Date(activity.NextActionDate));
    return due > today && due <= today + 7 * DAY_MS;
  }).length;
}