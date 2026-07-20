/**
 * Smart Attention Engine — canonical attention item (Phase 5A).
 * Users should not search for work; SmartCRM surfaces it.
 */

export type AttentionSeverity =
  | "urgent"
  | "needs_attention"
  | "waiting"
  | "healthy"
  | "completed";

export type AttentionStatus = "open" | "completed" | "dismissed";

export type AttentionObjectType =
  | "Company"
  | "Contact"
  | "Opportunity"
  | "Activity"
  | "Document"
  | "DocumentSet"
  | "TransmissionPackage"
  | "CommercialBaseline";

export type AttentionItem = {
  id: string;
  /** Primary entity this attention item refers to. */
  sourceObjectId: string;
  sourceObjectName: string;
  objectType: AttentionObjectType;
  severity: AttentionSeverity;
  status: AttentionStatus;
  /** Why this needs attention — shown as impact context. */
  recommendation: string;
  /** Primary suggested action label. */
  suggestedAiAction: string;
  ownerId?: string;
  ownerLabel?: string;
  dueDate?: string;
  href: string;
  companyId?: string;
  companyName?: string;
  /** Internal rule id — not shown in primary UI. */
  ruleId: string;
  /** Optional contact context for compose/call actions. */
  contactEmail?: string;
  contactPhone?: string;
};

export type AttentionActionKind =
  | "draft_email"
  | "schedule_meeting"
  | "create_contact"
  | "create_activity"
  | "build_document_set"
  | "create_transmission_package"
  | "navigate"
  | "complete_commitment";

export type AttentionAction = {
  kind: AttentionActionKind;
  label: string;
  href?: string;
  email?: string;
  phone?: string;
};

export type AttentionQueue = {
  urgent: AttentionItem[];
  needs_attention: AttentionItem[];
  waiting: AttentionItem[];
  healthy: AttentionItem[];
  completed: AttentionItem[];
};

export const ATTENTION_SEVERITY_LABELS: Record<AttentionSeverity, string> = {
  urgent: "Urgent",
  needs_attention: "Needs Attention",
  waiting: "Waiting",
  healthy: "Healthy",
  completed: "Completed",
};

import {
  ATTENTION_SEVERITY_ICONS,
  ATTENTION_OBJECT_ICONS,
} from "@/lib/smartcrm-visual-language";

export { ATTENTION_SEVERITY_ICONS, ATTENTION_OBJECT_ICONS };

export const ATTENTION_SEVERITY_STYLES: Record<AttentionSeverity, string> = {
  urgent: "border-red-500/25 bg-red-500/5 text-red-700",
  needs_attention: "border-upcycle-orange/25 bg-upcycle-orange/5 text-upcycle-orange",
  waiting: "border-carbon-blue/15 bg-carbon-blue/[0.03] text-carbon-blue/70",
  healthy: "border-emerald-500/20 bg-emerald-500/5 text-emerald-700",
  completed: "border-carbon-blue/10 bg-carbon-blue/[0.02] text-carbon-blue/45",
};

export const SEVERITY_RANK: Record<AttentionSeverity, number> = {
  urgent: 0,
  needs_attention: 1,
  waiting: 2,
  healthy: 3,
  completed: 4,
};

export function groupAttentionBySeverity(items: AttentionItem[]): AttentionQueue {
  const queue: AttentionQueue = {
    urgent: [],
    needs_attention: [],
    waiting: [],
    healthy: [],
    completed: [],
  };

  for (const item of items) {
    if (item.status === "completed") {
      queue.completed.push(item);
    } else {
      queue[item.severity].push(item);
    }
  }

  return queue;
}

export function sortAttentionItems(items: AttentionItem[]): AttentionItem[] {
  return [...items].sort((a, b) => {
    const severityDiff = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (severityDiff !== 0) return severityDiff;
    if (a.dueDate && b.dueDate) {
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    }
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return a.sourceObjectName.localeCompare(b.sourceObjectName);
  });
}

/** Flatten severity buckets into one sorted list for table views */
export function flattenAttentionQueue(
  queue: AttentionQueue,
  options?: { includeHealthy?: boolean; limit?: number },
): AttentionItem[] {
  const items = sortAttentionItems([
    ...queue.urgent,
    ...queue.needs_attention,
    ...queue.waiting,
    ...(options?.includeHealthy !== false ? queue.healthy : []),
  ]);
  return options?.limit ? items.slice(0, options.limit) : items;
}
