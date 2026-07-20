import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type {
  BusinessImpactLevel,
  SmartDocRecord,
  SmartDocTimelineEvent,
  SmartDocTimelineEventKind,
} from "@/types/smartdoc";
import { getActivitiesReferencingDocument } from "@/lib/smartdoc-registry";

function parseActivityDate(value: string): Date {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  return new Date(normalized);
}

function classifyActivityEvent(activity: Activity): SmartDocTimelineEventKind {
  const subject = activity.Subject.toLowerCase();
  const type = activity.ActivityType;

  if (type === "Proposal Sent" || subject.includes("approval") || subject.includes("approved")) {
    return "approval";
  }
  if (subject.includes("review") || type === "Technical Review") {
    return "review";
  }
  if (
    subject.includes("update") ||
    subject.includes("revision") ||
    subject.includes("upload")
  ) {
    return "update";
  }
  if (subject.includes("smartdoc") && activity.ActivityDescription.includes("renamed")) {
    return "creation";
  }
  return "reference";
}

export function buildSmartDocTimeline(
  document: SmartDocRecord,
  activities: Activity[],
  approvalRevision: number,
): SmartDocTimelineEvent[] {
  const refs = getActivitiesReferencingDocument(document, activities);
  const events: SmartDocTimelineEvent[] = [];

  for (const activity of refs) {
    const kind = classifyActivityEvent(activity);
    events.push({
      id: `timeline-${activity.ActivityID}-${kind}`,
      kind,
      label:
        kind === "creation"
          ? "Document created"
          : kind === "review"
            ? "Review recorded"
            : kind === "update"
              ? "Document updated"
              : kind === "approval"
                ? "Approval recorded"
                : "Referenced in activity",
      detail: activity.Subject,
      occurredAt: activity.ActivityDate,
      activityId: activity.ActivityID,
    });
  }

  if (events.length === 0) {
    events.push({
      id: `timeline-created-${document.id}`,
      kind: "creation",
      label: "Document registered",
      detail: `${document.fileName} added to SmartDocs registry`,
      occurredAt: new Date().toISOString(),
    });
  }

  if (approvalRevision >= 2 && !events.some((e) => e.kind === "approval")) {
    events.push({
      id: `timeline-approval-${document.id}`,
      kind: "approval",
      label: "Revision approved",
      detail: `Revision ${document.revision} marked approved in metadata`,
      occurredAt: events[0]?.occurredAt ?? new Date().toISOString(),
    });
  }

  return events.sort(
    (a, b) => parseActivityDate(b.occurredAt).getTime() - parseActivityDate(a.occurredAt).getTime(),
  );
}

export function computeBusinessImpactLevel(
  document: SmartDocRecord,
  pipeline: PipelineRow | undefined,
  refs: Activity[],
  companies: Company[],
  riskCount: number,
): BusinessImpactLevel {
  let score = 0;

  if (document.docCategory === "Compliance" || document.docCategory === "Legal") score += 2;
  if (document.docCategory === "Technical") score += 1;
  if (pipeline && pipeline.salesValue >= 1_000_000) score += 2;
  else if (pipeline && pipeline.salesValue >= 500_000) score += 1;
  if (refs.length >= 3) score += 1;
  if (companies.length >= 2) score += 1;
  if (riskCount >= 2) score += 2;
  else if (riskCount >= 1) score += 1;
  if (
    pipeline &&
    ["Contract Negotiation", "Site Installation", "Commissioning Phase", "Live Production"].includes(
      pipeline.status,
    )
  ) {
    score += 2;
  }

  if (score >= 6) return "Critical";
  if (score >= 4) return "High";
  if (score >= 2) return "Medium";
  return "Low";
}

export function businessImpactNarrative(
  level: BusinessImpactLevel,
  document: SmartDocRecord,
  pipeline: PipelineRow | undefined,
  companies: Company[],
): string {
  const deps =
    companies.length > 0
      ? `${companies.map((c) => c.Title).join(", ")} depend on this asset`
      : "Limited relationship dependencies tracked";

  switch (level) {
    case "Critical":
      return `Critical knowledge asset — ${document.docCategory} document with high-value opportunity dependencies. ${deps}.`;
    case "High":
      return `High business impact — governs ${pipeline?.assetName ?? "key operations"} or compliance posture. ${deps}.`;
    case "Medium":
      return `Moderate impact — supports ongoing relationship and delivery workflows. ${deps}.`;
    default:
      return `Supporting knowledge asset with limited tracked dependencies. ${deps}.`;
  }
}

export function isKnowledgeAtRisk(
  healthScore: number,
  businessImpact: BusinessImpactLevel,
  riskCount: number,
): boolean {
  if (businessImpact === "Critical" || businessImpact === "High") {
    return healthScore < 60 || riskCount > 0;
  }
  return healthScore < 40 || riskCount >= 2;
}
