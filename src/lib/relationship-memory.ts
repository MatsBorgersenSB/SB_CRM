import type {
  Activity,
  AgreedAction,
  LinkedDocument,
  SmartAssistAssessment,
} from "@/types/activity";
import type { SharePointLookup } from "@/types/company";
import type { ActivityStakeholder } from "@/types/activity";
import { isFollowUpOpen } from "@/lib/activity-utils";
import {
  buildStakeholdersFromActivity,
  knowledgeCompletenessScore,
} from "@/lib/activity-knowledge-engine";

export type ActivityMemoryView = {
  summary: string;
  keyDecisions: string[];
  agreedActions: AgreedAction[];
  risks: string[];
  linkedDocuments: LinkedDocument[];
  linkedDeals: SharePointLookup[];
  linkedContacts: SharePointLookup[];
  stakeholders: ActivityStakeholder[];
  smartAssistAssessment: SmartAssistAssessment | null;
  knowledgeCompleteness: number;
  /** Primary narrative — what happened */
  whatHappened: string;
  /** Agreements (non-decision) */
  whatWasAgreed: string[];
  /** Explicit customer decisions */
  decisions: string[];
  /** Structured commitments */
  commitments: AgreedAction[];
  /** Next step with optional due context */
  whatHappensNext: string | null;
  whatHappensNextDue: string | null;
  hasRichMemory: boolean;
};

function firstSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const match = trimmed.match(/^[^.!?]+[.!?]?/);
  return (match?.[0] ?? trimmed).trim();
}

function uniqueLookups(items: (SharePointLookup | null | undefined)[]): SharePointLookup[] {
  const seen = new Set<string>();
  const result: SharePointLookup[] = [];

  for (const item of items) {
    if (!item?.Title) continue;
    const key = `${item.Id}:${item.Title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }

  return result;
}

function inferDocumentsFromDescription(activity: Activity): LinkedDocument[] {
  if (activity.ActivityType !== "Proposal Sent") return [];

  const pdfMatch = activity.ActivityDescription.match(/[\w.-]+\.pdf/i);
  if (!pdfMatch) return [];

  return [
    {
      Title: pdfMatch[0],
      DocCategory: "Financial",
      DealId: activity.Deal?.Title,
    },
  ];
}

function deriveAssessment(activity: Activity): SmartAssistAssessment | null {
  if (activity.SmartAssistAssessment) return activity.SmartAssistAssessment;

  const score = knowledgeCompletenessScore(activity);
  if (score < 30) return null;

  const gaps: string[] = [];
  if (!activity.KeyDecisions?.length) gaps.push("Decisions not explicitly captured");
  if (!activity.AgreedActions?.length) gaps.push("Commitments not structured");
  if (!activity.Risks?.length) gaps.push("Risks not identified");

  return {
    generatedAt: activity.ActivityDate,
    confidence: score >= 80 ? "high" : score >= 50 ? "medium" : "low",
    summary: `Knowledge object ${score}% complete.`,
    completenessScore: score,
    gaps,
    recommendations: isFollowUpOpen(activity)
      ? [`Complete follow-up: ${activity.NextAction}`]
      : [],
  };
}

/** Parse newline- or bullet-separated user input into string items. */
export function parseMemoryLines(value: string): string[] {
  return value
    .split(/\n/)
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
}

/** Build agreed actions from newline-separated text (optional due date after |). */
export function parseAgreedActions(value: string): AgreedAction[] {
  return value
    .split(/\n/)
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean)
    .map((line) => {
      const [text, due] = line.split("|").map((part) => part.trim());
      return due ? { text, dueDate: due } : { text };
    });
}

export function buildRelationshipMemory(activity: Activity): ActivityMemoryView {
  const summary =
    activity.Summary?.trim() ||
    firstSentence(activity.ActivityDescription) ||
    activity.Subject;

  const keyDecisions = activity.KeyDecisions ?? [];
  const agreedActions = [...(activity.AgreedActions ?? [])];
  const risks = activity.Risks ?? [];
  const stakeholders = buildStakeholdersFromActivity(activity);

  const linkedDocuments =
    activity.LinkedDocuments?.length
      ? activity.LinkedDocuments
      : inferDocumentsFromDescription(activity);

  const linkedDeals = uniqueLookups([
    activity.Deal,
    ...(activity.LinkedDeals ?? []),
  ]);

  const linkedContacts = uniqueLookups([
    activity.Contact,
    ...(activity.LinkedContacts ?? []),
  ]);

  const whatHappened =
    activity.ActivityDescription.trim() || activity.Summary?.trim() || activity.Subject;

  const decisions = [...keyDecisions];

  const commitments = [...agreedActions];

  const whatWasAgreed = agreedActions.map((a) => a.text);

  const whatHappensNext =
    activity.ActionRequired && activity.NextAction.trim()
      ? activity.NextAction.trim()
      : null;

  const whatHappensNextDue =
    whatHappensNext && activity.NextActionDate ? activity.NextActionDate : null;

  const smartAssistAssessment = deriveAssessment(activity);
  const knowledgeCompleteness =
    smartAssistAssessment?.completenessScore ?? knowledgeCompletenessScore(activity);

  const hasRichMemory =
    Boolean(activity.Summary) ||
    keyDecisions.length > 0 ||
    agreedActions.length > 0 ||
    risks.length > 0 ||
    linkedDocuments.length > 0 ||
    linkedDeals.length > 1 ||
    linkedContacts.length > 1 ||
    stakeholders.length > 0 ||
    Boolean(smartAssistAssessment);

  return {
    summary,
    keyDecisions,
    agreedActions,
    risks,
    linkedDocuments,
    linkedDeals,
    linkedContacts,
    stakeholders,
    smartAssistAssessment,
    knowledgeCompleteness,
    whatHappened,
    whatWasAgreed,
    decisions,
    commitments,
    whatHappensNext,
    whatHappensNextDue,
    hasRichMemory,
  };
}

export function activityHasOpenCommitment(activity: Activity): boolean {
  return isFollowUpOpen(activity);
}
