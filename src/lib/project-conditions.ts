/**
 * Project conditions (FS-022) — the eight things that must be true for a plant
 * project to exist. If one is missing there is no project.
 *
 * Evidence rule (Reality First): a condition is confirmed only by what a person
 * recorded (captured answer or confirmed finding). Values inferred from deal
 * fields (e.g. feedstock type, deal value) never confirm a condition. The one
 * exception is the opportunity roster — named people with roles are real records.
 */

import type { PipelineRow, PipelineStatus } from "@/types/pipeline";
import type { FatalFlawId } from "@/types/commercial-viability";
import type { UnderstandingFieldId } from "@/types/opportunity-understanding";
import { resolveUnderstandingField } from "@/lib/opportunity-understanding-model";
import { salesMotionProfileFor } from "@/lib/sales-motion";

export type ProjectConditionId =
  | "feedstock"
  | "site"
  | "funding"
  | "offtake"
  | "decision_maker"
  | "sponsor"
  | "technology_fit"
  | "permitting";

export type ProjectConditionDefinition = {
  id: ProjectConditionId;
  label: string;
  /** Plain-language question the seller can answer. */
  question: string;
  /** All of these must have evidence for the condition to be confirmed. */
  fieldIds: UnderstandingFieldId[];
  flawId: FatalFlawId;
  severity: "critical" | "high";
  whyItMatters: string;
  recommendedAction: string;
};

export const PROJECT_CONDITIONS: ProjectConditionDefinition[] = [
  {
    id: "feedstock",
    label: "Feedstock",
    question: "Is there enough feedstock of known quality?",
    fieldIds: ["feedstock_volume", "feedstock_quality"],
    flawId: "no_feedstock",
    severity: "critical",
    whyItMatters: "A plant cannot operate without secure feedstock; the business case and financing depend on it.",
    recommendedAction: "Confirm annual volume and quality specification with the customer or supplier",
  },
  {
    id: "site",
    label: "Site and utilities",
    question: "Is there a site, and can it supply what the plant needs?",
    fieldIds: ["site_readiness", "utilities"],
    flawId: "no_site",
    severity: "critical",
    whyItMatters: "Equipment cannot be sized or permitted without a real site and confirmed utilities.",
    recommendedAction: "Confirm the site, its readiness and available utility capacity",
  },
  {
    id: "funding",
    label: "Funding",
    question: "Can the customer pay for it?",
    fieldIds: ["funding_source", "budget"],
    flawId: "no_financing",
    severity: "critical",
    whyItMatters: "Without a funding path the customer may never be able to sign the contract.",
    recommendedAction: "Confirm funding source and budget range with the economic buyer",
  },
  {
    id: "offtake",
    label: "Offtake",
    question: "Who buys or uses what the plant produces?",
    fieldIds: ["offtake_strategy"],
    flawId: "no_offtake",
    severity: "high",
    whyItMatters: "Without a revenue path the investment committee will not approve the project.",
    recommendedAction: "Clarify the end-product route and any offtake or carbon-credit commitments",
  },
  {
    id: "decision_maker",
    label: "Decision maker",
    question: "Who decides, and who holds the budget?",
    fieldIds: ["decision_maker", "economic_buyer"],
    flawId: "no_decision_maker",
    severity: "high",
    whyItMatters: "Proposals stall when nobody with authority has seen them.",
    recommendedAction: "Record who owns the go / no-go decision and who signs off the investment",
  },
  {
    id: "sponsor",
    label: "Sponsor",
    question: "Who inside the customer is pushing this forward?",
    fieldIds: ["stakeholder_map"],
    flawId: "no_sponsor",
    severity: "high",
    whyItMatters: "Single-threaded deals stall at the investment committee.",
    recommendedAction: "Identify the internal sponsor or champion and add them to the roster",
  },
  {
    id: "technology_fit",
    label: "Technology fit",
    question: "Does our technology fit this application?",
    fieldIds: ["technical_fit"],
    flawId: "technology_mismatch",
    severity: "high",
    whyItMatters: "A poor fit wastes engineering time and risks a failed delivery.",
    recommendedAction: "Record the fit assessment and any open technical risks",
  },
  {
    id: "permitting",
    label: "Permitting",
    question: "Is there a realistic path to a permit?",
    fieldIds: ["permitting"],
    flawId: "unrealistic_permitting",
    severity: "high",
    whyItMatters: "No permit means no plant. Permitting is a leading cause of project failure and delay.",
    recommendedAction: "Establish the permitting pathway, authority and expected timeline",
  },
];

export type ProjectConditionStatus = "confirmed" | "partial" | "unknown";

export type ProjectConditionState = ProjectConditionDefinition & {
  status: ProjectConditionStatus;
  /** Fields that still have no evidence. */
  missingFieldIds: UnderstandingFieldId[];
  /** What is missing, in the seller's words. */
  missingLabels: string[];
};

/** Roster entries are real people with roles — they count as evidence. */
const ROSTER_EVIDENCE_FIELDS = new Set<UnderstandingFieldId>([
  "decision_maker",
  "economic_buyer",
]);

function fieldHasEvidence(deal: PipelineRow, fieldId: UnderstandingFieldId): boolean {
  const resolved = resolveUnderstandingField(deal, fieldId);
  if (resolved.source === "captured") return true;
  return resolved.source === "derived" && ROSTER_EVIDENCE_FIELDS.has(fieldId);
}

function rosterHasSponsor(deal: PipelineRow): boolean {
  return (deal.team ?? []).some((member) => /sponsor|champion/i.test(member.projectRole));
}

/** Project conditions apply to plant (system) sales — and to deals not yet classified. */
export function projectConditionsApply(deal: Pick<PipelineRow, "offeringIds">): boolean {
  const profile = salesMotionProfileFor(deal);
  return profile === null || profile.motion === "system";
}

export function evaluateProjectConditions(deal: PipelineRow): ProjectConditionState[] {
  if (!projectConditionsApply(deal)) return [];

  return PROJECT_CONDITIONS.map((condition) => {
    const missingFieldIds = condition.fieldIds.filter((fieldId) => {
      if (condition.id === "sponsor") {
        return !(rosterHasSponsor(deal) || resolveUnderstandingField(deal, fieldId).source === "captured");
      }
      return !fieldHasEvidence(deal, fieldId);
    });
    const status: ProjectConditionStatus =
      missingFieldIds.length === 0
        ? "confirmed"
        : missingFieldIds.length === condition.fieldIds.length
          ? "unknown"
          : "partial";
    return {
      ...condition,
      status,
      missingFieldIds,
      missingLabels: missingFieldIds.map((id) => resolveUnderstandingField(deal, id).definition.label),
    };
  });
}

/** Conditions that still stand between this deal and Won. Empty for offer sales. */
export function projectWonBlockers(deal: PipelineRow): ProjectConditionState[] {
  return evaluateProjectConditions(deal).filter((condition) => condition.status !== "confirmed");
}

/** Flaw ids that mean "evidence missing" rather than a proven deal-breaker. */
export const PROJECT_CONDITION_FLAW_IDS: ReadonlySet<FatalFlawId> = new Set(
  PROJECT_CONDITIONS.map((condition) => condition.flawId),
);

/** Won and everything after it — reaching any of these means the deal was won. */
const WON_OR_LATER: ReadonlySet<PipelineStatus> = new Set<PipelineStatus>([
  "Won",
  "Reactor Manufacturing",
  "Site Installation",
  "Commissioning Phase",
  "Live Production",
  "Scheduled Maintenance",
]);

/**
 * Won gate (FS-022 §4.2). Evaluates the deal as it would be after the patch, so
 * answers saved in the same request count. Returns the conditions still open;
 * empty means the move is allowed. Offer sales are never gated.
 */
export function projectWonGateBlockers(
  before: PipelineRow,
  patch: Partial<PipelineRow>,
): ProjectConditionState[] {
  const targetsWon =
    patch.salesStageId === "won" ||
    (patch.status !== undefined && WON_OR_LATER.has(patch.status));
  if (!targetsWon) return [];
  if (before.salesStageId === "won" || WON_OR_LATER.has(before.status)) return [];
  return projectWonBlockers({ ...before, ...patch });
}