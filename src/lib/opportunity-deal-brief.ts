/**
 * FS-005A — Customer-Centric Deal Brief engine.
 *
 * Pure and deterministic. Turns what we KNOW about a deal into a verdict, three
 * single-line answers (want / block / next) and one "what changed" line.
 *
 * Reality First: only captured facts count as Confirmed. Inferred text is Assumed
 * and never moves the verdict. Unknown stays Unknown.
 */
import type { Activity } from "@/types/activity";
import type { AttentionItem } from "@/types/attention-item";
import type { FatalFlawAlert } from "@/types/commercial-viability";
import type { PipelineRow } from "@/types/pipeline";
import {
  UNDERSTANDING_FIELD_BY_ID,
  type UnderstandingFieldId,
} from "@/types/opportunity-understanding";
import { resolveUnderstandingField } from "@/lib/opportunity-understanding-model";
import { resolveSalesMotion, understandingFieldsForPipeline } from "@/lib/sales-motion";

export type KnowledgeState = "confirmed" | "assumed" | "unknown";

export type BriefElementId =
  | "customer_problem"
  | "who_decides"
  | "why_now"
  | "next_step"
  | "customer_value"
  | "customer_vision"
  // Build-Own-Operate only (FS-005B)
  | "feedstock_agreement"
  | "site_control"
  | "utilities"
  | "permitting"
  | "funding"
  | "public_funding"
  | "offtake"
  | "biochar_offtake";

export type DealVerdictId = "at_risk" | "not_understood" | "needs_attention" | "clear_path";

export type BriefElement = {
  id: BriefElementId;
  label: string;
  state: KnowledgeState;
  /** What we know, in plain words. Null when Unknown. */
  statement: string | null;
  /** Where it came from. Null when Unknown. */
  source: string | null;
};

export type BriefRow = {
  /** One line, plain words. */
  headline: string;
  /** Why it matters. Mandatory — a row without impact is never produced. */
  impact: string;
  /** Behind the "Why" toggle. */
  why?: string;
  state?: KnowledgeState;
  source?: string | null;
  /** Understanding field to open for "Answer now". */
  fieldId?: UnderstandingFieldId;
};

export type DealBrief = {
  verdict: { id: DealVerdictId; label: string; impact: string };
  want: BriefRow;
  blocker: BriefRow;
  next: BriefRow;
  /** Column headings, worded for the deal model. */
  columns: { want: string; blocker: string; next: string };
  /** One line: last customer touch plus anything new since the last visit. */
  whatChanged: string;
  /** Weakest unconfirmed element, null when everything is Confirmed. */
  weakestLink: BriefElementId | null;
  elements: BriefElement[];
};

export type BuildDealBriefInput = {
  pipeline: PipelineRow;
  /** Activities already scoped to this deal. */
  activities: Activity[];
  fatalFlawAlerts?: FatalFlawAlert[];
  attentionItems?: AttentionItem[];
  /** Inferred objective text — only ever treated as Assumed. */
  assumedProblem?: string | null;
  /** Days of customer silence before the verdict becomes At risk. Default 21. */
  silenceDays?: number;
  /** ISO time of the user's previous visit, when known. */
  lastVisitedAt?: string | null;
  now?: Date;
};

export const DEFAULT_SILENCE_DAYS = 21;

/**
 * Stages from which permits and funding gate a Build-Own-Operate "Clear path" (FS-005B 6, 8).
 * Build-Own-Operate shares the Project sales pipeline: Negotiation is where agreements and
 * financing are negotiated, and Won means financial close.
 */
export const BOO_FINANCING_GATE_STAGE_IDS: readonly string[] = ["negotiation", "won"];

/** Build-Own-Operate weakest-link order (FS-005B 6). */
export const BOO_WEAKEST_LINK_ORDER: readonly BriefElementId[] = [
  "customer_problem",
  "who_decides",
  "offtake",
  "biochar_offtake",
  "feedstock_agreement",
  "site_control",
  "utilities",
  "why_now",
  "next_step",
  "permitting",
  "funding",
  "public_funding",
  "customer_value",
  "customer_vision",
];

/** Items that only gate the verdict once the deal reaches the financing stage. */
const BOO_LATE_GATES: readonly BriefElementId[] = ["permitting", "funding", "public_funding"];
/** Shown as the next step on a Clear path, but never a gate. */
const BOO_LATER_FOLLOW_UPS: readonly BriefElementId[] = [
  "permitting",
  "funding",
  "public_funding",
];

/** Order of weakness: the first element not Confirmed is the blocker. */
export const WEAKEST_LINK_ORDER: readonly BriefElementId[] = [
  "customer_problem",
  "who_decides",
  "why_now",
  "next_step",
  "customer_value",
  "customer_vision",
];

const CUSTOMER_TOUCH_TYPES = new Set<Activity["ActivityType"]>([
  "Phone Call",
  "Email",
  "Email Follow-Up",
  "Teams Meeting",
  "Meeting",
  "Site Visit",
  "Proposal Sent",
]);

const MEETING_TYPES = new Set<Activity["ActivityType"]>([
  "Phone Call",
  "Teams Meeting",
  "Meeting",
  "Site Visit",
]);

const OPEN_STATUSES = new Set<Activity["ActionStatus"]>([
  "Planned",
  "Open",
  "In Progress",
  "Waiting",
]);

const ELEMENT_LABEL: Record<BriefElementId, string> = {
  customer_problem: "Customer problem",
  who_decides: "Who decides",
  why_now: "Why now",
  next_step: "Agreed next step",
  customer_value: "What it is worth to them",
  customer_vision: "What they picture",
  feedstock_agreement: "Feedstock agreement",
  site_control: "Site control (land plot)",
  utilities: "Shared utilities",
  permitting: "Permits",
  funding: "Ownership and financing",
  public_funding: "Public funding",
  offtake: "Energy and heat offtake",
  biochar_offtake: "Biochar product offtake",
};

const BOO_LABEL: Partial<Record<BriefElementId, string>> = {
  customer_problem: "What they need solved",
  who_decides: "Who signs the agreements",
  next_step: "Agreed next step",
};

const ELEMENT_ACTION: Record<BriefElementId, string> = {
  customer_problem: "Ask the customer to describe the problem in their own words",
  who_decides: "Find out who can approve this and add them to the opportunity",
  why_now: "Ask what forces a decision and by when",
  next_step: "Agree a dated next step with the customer",
  customer_value: "Ask what the problem costs them today",
  customer_vision: "Ask what a good outcome looks like to them",
  feedstock_agreement: "Agree feedstock volume, term and price with the supplier",
  site_control: "Agree and secure lease/rent or purchase terms for the land plot",
  utilities: "Confirm utility capacity and secure shared heat, power and water tie-in terms",
  permitting: "Confirm which permits are needed and where each stands",
  funding: "Agree the ownership and financing structure (BOO, JV, investors or lenders)",
  public_funding: "Identify applicable grants or subsidies and record their status",
  offtake: "Agree who takes the surplus thermal energy, and at what price and term",
  biochar_offtake: "Secure offtake buyers, specifications and pricing for the biochar product",
};

const BOO_ACTION: Partial<Record<BriefElementId, string>> = {
  customer_problem: "Ask them to describe what they need solved, in their own words",
  who_decides: "Find out who can sign the feedstock, energy and site agreements",
  why_now: "Ask what forces a decision and by when",
  next_step: "Agree a dated next step with them",
};

const ELEMENT_UNKNOWN_LINE: Record<BriefElementId, string> = {
  customer_problem: "We do not yet know what the customer is trying to fix",
  who_decides: "We do not yet know who can say yes",
  why_now: "The customer has no stated reason to decide now",
  next_step: "No dated next step is agreed with the customer",
  customer_value: "The customer has not put a value on the problem",
  customer_vision: "We do not know what a good outcome looks like to the customer",
  feedstock_agreement: "No feedstock agreement is in place",
  site_control: "Land plot lease or ownership is not secured",
  utilities: "Utilities and tie-ins are not yet secured",
  permitting: "Permits are not confirmed",
  funding: "Ownership and financing structure is not yet decided",
  public_funding: "Public funding is not confirmed",
  offtake: "Offtake for the surplus thermal energy is not agreed",
  biochar_offtake: "Offtake for the biochar product is not yet secured",
};

const BOO_UNKNOWN: Partial<Record<BriefElementId, string>> = {
  customer_problem: "We do not yet know what they need solved",
  who_decides: "We do not yet know who can sign the agreements",
  why_now: "There is no stated reason to decide now",
  next_step: "No dated next step is agreed",
};

const ELEMENT_IMPACT: Record<BriefElementId, string> = {
  customer_problem:
    "Without a confirmed problem every next step is a guess and the deal can stall without warning.",
  who_decides: "Proposals stall when nobody with authority has seen them.",
  why_now: "Deals without a reason to decide drift; a deadline is what turns interest into a decision.",
  next_step: "Without a dated step agreed with the customer, momentum depends on chance.",
  customer_value: "If the customer has not valued the problem, price becomes the only comparison.",
  customer_vision:
    "A proposal that does not match what the customer pictures gets rejected even when it is sound.",
  feedstock_agreement: "Without committed feedstock there is no plant to finance.",
  site_control: "We cannot permit or finance a plant on a land plot we have not secured.",
  utilities: "Shared heat, power and water tie-ins can make or break the plant's economics and layout.",
  permitting: "Without permits the plant cannot be financed or built.",
  funding: "Before financial close, the ownership split and financing structure must be agreed.",
  public_funding: "Grants and subsidies can decide whether the plant is financeable.",
  offtake: "Without a committed buyer for the surplus thermal energy, local heat income is a guess.",
  biochar_offtake: "Biochar sales and carbon credits are a core revenue pillar of the plant.",
};

const BOO_IMPACT: Partial<Record<BriefElementId, string>> = {
  customer_problem:
    "Without a confirmed problem we cannot judge what they will commit to, and the agreement can stall without warning.",
  who_decides: "Agreements stall when the person who can sign has not been engaged.",
  why_now: "Without a reason to decide, agreements drift; a deadline turns interest into a signature.",
  next_step: "Without a dated step agreed with them, momentum depends on chance.",
};

type ElementText = {
  label: Record<BriefElementId, string>;
  action: Record<BriefElementId, string>;
  unknown: Record<BriefElementId, string>;
  impact: Record<BriefElementId, string>;
};

function elementText(boo: boolean): ElementText {
  return boo
    ? {
        label: { ...ELEMENT_LABEL, ...BOO_LABEL },
        action: { ...ELEMENT_ACTION, ...BOO_ACTION },
        unknown: { ...ELEMENT_UNKNOWN_LINE, ...BOO_UNKNOWN },
        impact: { ...ELEMENT_IMPACT, ...BOO_IMPACT },
      }
    : {
        label: ELEMENT_LABEL,
        action: ELEMENT_ACTION,
        unknown: ELEMENT_UNKNOWN_LINE,
        impact: ELEMENT_IMPACT,
      };
}

function parseDate(value: string | undefined | null): Date | null {
  if (!value?.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

function formatShortDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function hasCustomerContact(activity: Activity): boolean {
  return (
    Boolean(activity.Contact?.Title?.trim()) || (activity.LinkedContacts?.length ?? 0) > 0
  );
}

const OPEN_WORK_NOTE_PATTERN =
  /\b(not yet decided|yet to be discussed|to be discussed|to be investigated|must apply|must prepare|tbd|tbc)\b/i;

function customerFieldElement(
  pipeline: PipelineRow,
  fieldId: UnderstandingFieldId,
  id: BriefElementId,
  label: string,
  assumed?: string | null,
): BriefElement {
  const resolved = resolveUnderstandingField(pipeline, fieldId);
  if (resolved.source === "captured") {
    const entered = pipeline.understanding?.fields?.[fieldId]?.trim();
    const isPendingLateGate =
      BOO_LATE_GATES.includes(id) && OPEN_WORK_NOTE_PATTERN.test(resolved.value);
    return {
      id,
      label,
      state: isPendingLateGate ? "assumed" : "confirmed",
      statement: resolved.value,
      source: entered ? "Entered on this opportunity" : "Confirmed from a source finding",
    };
  }
  if (assumed?.trim()) {
    return {
      id,
      label,
      state: "assumed",
      statement: assumed.trim(),
      source: "Inferred from project context — not confirmed with the customer",
    };
  }
  return { id, label, state: "unknown", statement: null, source: null };
}

function whoDecidesElement(pipeline: PipelineRow, label: string): BriefElement {
  for (const fieldId of ["decision_maker", "economic_buyer"] as const) {
    const resolved = resolveUnderstandingField(pipeline, fieldId);
    if (resolved.source === "captured") {
      return {
        id: "who_decides",
        label,
        state: "confirmed",
        statement: resolved.value,
        source: "Entered on this opportunity",
      };
    }
    // Roster assignment is a person's explicit choice, so it counts as confirmed.
    if (resolved.source === "derived") {
      return {
        id: "who_decides",
        label,
        state: "confirmed",
        statement: resolved.value,
        source: "Assigned on the opportunity roster",
      };
    }
  }
  return {
    id: "who_decides",
    label,
    state: "unknown",
    statement: null,
    source: null,
  };
}

/** Derived, never stored: a dated, open step that involves a customer contact. */
function agreedNextStepElement(activities: Activity[], now: Date): BriefElement {
  const today = startOfDay(now);
  const candidates: Array<{ when: Date; text: string; source: string }> = [];

  for (const activity of activities) {
    if (activity.ActionStatus === "Cancelled" || !hasCustomerContact(activity)) continue;

    const followUp = parseDate(activity.NextActionDate);
    if (activity.ActionRequired && followUp && followUp >= today) {
      candidates.push({
        when: followUp,
        text: activity.NextAction?.trim() || activity.Subject,
        source: `Activity ${activity.ActivityID}`,
      });
    }

    for (const agreed of activity.AgreedActions ?? []) {
      const due = parseDate(agreed.dueDate);
      if (agreed.text?.trim() && due && due >= today) {
        candidates.push({
          when: due,
          text: agreed.text.trim(),
          source: `Agreed action on ${activity.ActivityID}`,
        });
      }
    }

    const held = parseDate(activity.ActivityDate);
    if (
      OPEN_STATUSES.has(activity.ActionStatus) &&
      held &&
      held >= now &&
      MEETING_TYPES.has(activity.ActivityType)
    ) {
      candidates.push({
        when: held,
        text: activity.Subject,
        source: `Planned activity ${activity.ActivityID}`,
      });
    }
  }

  candidates.sort((a, b) => a.when.getTime() - b.when.getTime());
  const next = candidates[0];
  if (!next) {
    return {
      id: "next_step",
      label: ELEMENT_LABEL.next_step,
      state: "unknown",
      statement: null,
      source: null,
    };
  }
  return {
    id: "next_step",
    label: ELEMENT_LABEL.next_step,
    state: "confirmed",
    statement: `${next.text} on ${formatShortDate(next.when)}`,
    source: next.source,
  };
}

function lastCustomerTouch(activities: Activity[], now: Date): { activity: Activity; when: Date } | null {
  let latest: { activity: Activity; when: Date } | null = null;
  for (const activity of activities) {
    if (activity.ActionStatus === "Cancelled") continue;
    if (!CUSTOMER_TOUCH_TYPES.has(activity.ActivityType)) continue;
    const when = parseDate(activity.ActivityDate);
    if (!when || when > now) continue;
    if (!latest || when > latest.when) latest = { activity, when };
  }
  return latest;
}

function describeAge(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

function buildWhatChanged(
  activities: Activity[],
  pipeline: PipelineRow,
  now: Date,
  lastVisitedAt: Date | null,
): string {
  const touch = lastCustomerTouch(activities, now);
  const parts: string[] = [
    touch
      ? `Last customer contact: ${touch.activity.ActivityType.toLowerCase()} ${describeAge(daysBetween(touch.when, now))}.`
      : "No customer contact logged yet.",
  ];

  if (lastVisitedAt) {
    const fresh = activities.filter((activity) => {
      const when = parseDate(activity.ActivityDate);
      return when && when > lastVisitedAt && when <= now;
    }).length;
    const updated = parseDate(pipeline.understanding?.updatedAt);
    const understandingChanged = Boolean(updated && updated > lastVisitedAt);
    if (fresh > 0 || understandingChanged) {
      const bits: string[] = [];
      if (fresh > 0) bits.push(`${fresh} new ${fresh === 1 ? "activity" : "activities"}`);
      if (understandingChanged) bits.push("understanding updated");
      parts.push(`Since you last looked: ${bits.join(", ")}.`);
    } else {
      parts.push("Nothing new since you last looked.");
    }
  }
  return parts.join(" ");
}

type RiskCause = { headline: string; impact: string; action: string; why: string };

function findRisk(
  input: BuildDealBriefInput,
  now: Date,
  silenceDays: number,
): RiskCause | null {
  const alert = input.fatalFlawAlerts?.find(
    (entry) => entry.severity === "critical" || entry.severity === "high",
  );
  if (alert) {
    const impact =
      alert.impact[0]?.trim() ||
      alert.detail?.trim() ||
      "This may stop the project being funded, permitted or built.";
    return {
      headline: alert.label,
      impact,
      action: alert.recommendedAction,
      why: alert.detail,
    };
  }

  const urgent = input.attentionItems?.find(
    (item) =>
      item.severity === "urgent" &&
      item.status === "open" &&
      item.sourceObjectId === input.pipeline.id,
  );
  if (urgent && urgent.recommendation?.trim()) {
    return {
      headline: urgent.suggestedAiAction || "Urgent item needs attention",
      impact: urgent.recommendation,
      action: urgent.suggestedAiAction || "Open the urgent item",
      why: urgent.recommendation,
    };
  }

  const touch = lastCustomerTouch(input.activities, now);
  if (touch) {
    const quiet = daysBetween(touch.when, now);
    if (quiet > silenceDays) {
      return {
        headline: `No customer contact for ${quiet} days`,
        impact: `No customer contact for ${quiet} days; the deal may be going cold.`,
        action: "Re-contact the customer and agree a dated next step",
        why: `The last customer touch was ${describeAge(quiet)}. Silence beyond ${silenceDays} days is a risk signal.`,
      };
    }
  }
  return null;
}

export function dealBriefApplies(pipeline: PipelineRow): boolean {
  return understandingFieldsForPipeline(pipeline).some((field) => field.id === "customer_problem");
}

const VERDICT_LABEL: Record<DealVerdictId, string> = {
  at_risk: "At risk",
  not_understood: "Not yet understood",
  needs_attention: "Needs attention",
  clear_path: "Clear path",
};

function elementFieldId(id: BriefElementId): UnderstandingFieldId | undefined {
  switch (id) {
    case "customer_problem":
      return "customer_problem";
    case "who_decides":
      return "decision_maker";
    case "why_now":
      return "why_now";
    case "customer_value":
      return "customer_value";
    case "customer_vision":
      return "customer_vision";
    case "feedstock_agreement":
      return "feedstock_agreement";
    case "site_control":
      return "site_readiness";
    case "utilities":
      return "utilities";
    case "permitting":
      return "permitting";
    case "funding":
      return "funding_source";
    case "public_funding":
      return "public_funding";
    case "offtake":
      return "offtake_strategy";
    case "biochar_offtake":
      return "end_product";
    default:
      return undefined;
  }
}

const BOO_FIELD_ELEMENTS: readonly BriefElementId[] = [
  "feedstock_agreement",
  "site_control",
  "utilities",
  "permitting",
  "funding",
  "public_funding",
  "offtake",
  "biochar_offtake",
];

export function buildDealBrief(input: BuildDealBriefInput): DealBrief {
  const now = input.now ?? new Date();
  const silenceDays = input.silenceDays ?? DEFAULT_SILENCE_DAYS;
  const { pipeline, activities } = input;

  // FS-005B: Build-Own-Operate changes the questions and the gates, not the engine.
  const boo = resolveSalesMotion(pipeline).motion === "boo";
  const text = elementText(boo);
  const financingGate =
    boo && BOO_FINANCING_GATE_STAGE_IDS.includes(String(pipeline.salesStageId ?? ""));
  const fieldDefs = new Map(understandingFieldsForPipeline(pipeline).map((field) => [field.id, field]));
  const defOf = (id: UnderstandingFieldId) => fieldDefs.get(id) ?? UNDERSTANDING_FIELD_BY_ID[id];

  const elements: BriefElement[] = [
    customerFieldElement(
      pipeline,
      "customer_problem",
      "customer_problem",
      text.label.customer_problem,
      input.assumedProblem,
    ),
    whoDecidesElement(pipeline, text.label.who_decides),
    customerFieldElement(pipeline, "why_now", "why_now", text.label.why_now),
    agreedNextStepElement(activities, now),
    customerFieldElement(pipeline, "customer_value", "customer_value", text.label.customer_value),
    customerFieldElement(pipeline, "customer_vision", "customer_vision", text.label.customer_vision),
  ];
  if (boo) {
    for (const id of BOO_FIELD_ELEMENTS) {
      elements.push(customerFieldElement(pipeline, elementFieldId(id)!, id, text.label[id]));
    }
  }
  const byId = Object.fromEntries(elements.map((element) => [element.id, element])) as Record<
    BriefElementId,
    BriefElement
  >;

  const weakestLink =
    (boo ? BOO_WEAKEST_LINK_ORDER : WEAKEST_LINK_ORDER).find(
      (id) => byId[id].state !== "confirmed",
    ) ?? null;

  const risk = findRisk(input, now, silenceDays);

  // Items that stop "Clear path". Permits and funding join them from the financing stage.
  const gates: readonly BriefElementId[] = boo
    ? [
        "who_decides",
        "offtake",
        "biochar_offtake",
        "feedstock_agreement",
        "site_control",
        "utilities",
        "why_now",
        "next_step",
        ...(financingGate ? BOO_LATE_GATES : []),
      ]
    : ["who_decides", "why_now", "next_step"];
  const openGate = gates.find((id) => byId[id].state !== "confirmed");

  // Verdict — first match wins (FS-005A 5.4, FS-005B 6).
  let verdictId: DealVerdictId;
  let verdictImpact: string;
  if (risk) {
    verdictId = "at_risk";
    verdictImpact = risk.impact;
  } else if (byId.customer_problem.state !== "confirmed") {
    verdictId = "not_understood";
    verdictImpact = text.impact.customer_problem;
  } else if (openGate) {
    verdictId = "needs_attention";
    verdictImpact = `${text.unknown[openGate]}. ${text.impact[openGate]}`;
  } else {
    verdictId = "clear_path";
    verdictImpact = !boo
      ? "The customer has a reason, a decider and a dated next step."
      : financingGate
        ? "Agreements, site, permits and funding are confirmed."
        : "Inputs are secured; the next step is permits and funding.";
  }

  // Row 1 — what the customer wants.
  const problem = byId.customer_problem;
  const vision = byId.customer_vision;
  const want: BriefRow =
    problem.state === "confirmed"
      ? {
          headline:
            vision.state === "confirmed"
              ? `${problem.statement} — they picture: ${vision.statement}`
              : (problem.statement as string),
          impact: boo
            ? "This is what they told us, so the proposal can speak to it directly."
            : "This is what the customer told us, so a proposal can speak to it directly.",
          state: "confirmed",
          source: problem.source,
          fieldId: "customer_problem",
        }
      : problem.state === "assumed"
        ? {
            headline: `Working view, not confirmed: ${problem.statement}`,
            impact: text.impact.customer_problem,
            why: problem.source ?? undefined,
            state: "assumed",
            source: problem.source,
            fieldId: "customer_problem",
          }
        : {
            headline: "Not confirmed yet",
            impact: text.impact.customer_problem,
            why: defOf("customer_problem").prompt,
            state: "unknown",
            source: null,
            fieldId: "customer_problem",
          };

  // On a Clear path, "what it is worth" and "what they picture" never override the
  // agreed step. A Build-Own-Operate Clear path still points at permits and funding.
  const activeLink: BriefElementId | null =
    verdictId === "clear_path"
      ? boo
        ? (BOO_LATER_FOLLOW_UPS.find((id) => byId[id].state !== "confirmed") ?? null)
        : null
      : weakestLink;

  // Row 2 — what is blocking progress.
  let blocker: BriefRow;
  if (risk) {
    blocker = { headline: risk.headline, impact: risk.impact, why: risk.why };
  } else if (activeLink) {
    const activeElement = byId[activeLink];
    blocker = {
      headline:
        activeElement.state === "assumed" && activeElement.statement
          ? activeElement.statement
          : text.unknown[activeLink],
      impact: text.impact[activeLink],
      why: defOf(elementFieldId(activeLink) ?? "customer_problem").whyItMatters,
      state: activeElement.state,
      source: activeElement.source,
      fieldId: elementFieldId(activeLink),
    };
  } else {
    const overdue = activities.find(
      (activity) =>
        OPEN_STATUSES.has(activity.ActionStatus) &&
        activity.ActionRequired &&
        parseDate(activity.NextActionDate) !== null &&
        (parseDate(activity.NextActionDate) as Date) < startOfDay(now),
    );
    blocker = overdue
      ? {
          headline: `Overdue follow-up: ${overdue.NextAction?.trim() || overdue.Subject}`,
          impact: "A promised follow-up that slips tells the other side we are not ready to move.",
        }
      : {
          headline: "Nothing is blocking progress",
          impact: boo
            ? "Agreements, site and next step are all confirmed."
            : "The customer's problem, decider, reason and next step are all confirmed.",
        };
  }

  // Row 3 — what should happen next (single source of next action).
  let next: BriefRow;
  if (risk) {
    next = { headline: risk.action, impact: risk.impact, why: risk.why };
  } else if (activeLink) {
    next = {
      headline: text.action[activeLink],
      impact: text.impact[activeLink],
      fieldId: elementFieldId(activeLink),
    };
  } else {
    next = {
      headline: `Keep the agreed step on track: ${byId.next_step.statement}`,
      impact: boo
        ? "They have agreed the next move; protecting it keeps the agreements moving."
        : "The customer has agreed the next move; protecting it keeps the deal moving.",
      source: byId.next_step.source,
    };
  }

  return {
    verdict: { id: verdictId, label: VERDICT_LABEL[verdictId], impact: verdictImpact },
    want,
    blocker,
    next,
    columns: boo
      ? {
          want: "What they need solved",
          blocker: "What is blocking the plant",
          next: "What should happen next",
        }
      : {
          want: "What the customer wants",
          blocker: "What is blocking progress",
          next: "What should happen next",
        },
    whatChanged: buildWhatChanged(activities, pipeline, now, parseDate(input.lastVisitedAt)),
    weakestLink,
    elements,
  };
}