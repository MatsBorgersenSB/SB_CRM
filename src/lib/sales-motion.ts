import type { PipelineRow } from "@/types/pipeline";
import type {
  ResolvedSalesMotion,
  SalesMotion,
  SalesMotionProfile,
} from "@/types/sales-motion";
import type {
  UnderstandingFieldDefinition,
  UnderstandingFieldId,
} from "@/types/opportunity-understanding";
import { UNDERSTANDING_FIELDS } from "@/types/opportunity-understanding";
import { resolveOfferings } from "@/lib/standard-bio-offerings";

const ALL_VIABILITY_DIMENSIONS = [
  "buying_drivers",
  "business_case_strength",
  "financial_readiness",
  "feedstock_readiness",
  "project_readiness",
  "offtake_readiness",
  "delivery_readiness",
  "decision_readiness",
  "competitive_position",
  "commercial_momentum",
  "strategic_value",
  "resource_efficiency",
  "revenue_path",
] as const;

const ALL_FATAL_FLAWS = [
  "no_site",
  "no_feedstock",
  "no_financing",
  "no_offtake",
  "no_sponsor",
  "no_decision_maker",
  "technology_mismatch",
  "utility_constraints",
  "unrealistic_permitting",
  "no_engagement",
  "commercial_stall",
] as const;

/**
 * One profile per selling process.
 *
 * System sales are project-driven: customer must fund, permit, feed and site a plant,
 * so the full investigation stays. Product and consulting sales are transactional:
 * the customer states a need — we confirm who, how much, by when, and quote.
 */
export const SALES_MOTION_PROFILES: Record<SalesMotion, SalesMotionProfile> = {
  system: {
    motion: "system",
    label: "Pyrolysis system sale",
    process: "Qualify the project → validate feasibility → propose → negotiate CAPEX contract",
    depth: "full",
    understandingFieldIds: UNDERSTANDING_FIELDS.map((field) => field.id),
    fieldOverrides: {},
    viabilityDimensionIds: [...ALL_VIABILITY_DIMENSIONS],
    fatalFlawIds: [...ALL_FATAL_FLAWS],
    engagementGap: true,
    offeringQuestionLimit: 3,
    projectInvestigation: true,
  },
  product: {
    motion: "product",
    label: "Product sale",
    process: "Confirm the need → quote → order → deliver",
    depth: "minimal",
    understandingFieldIds: ["decision_maker", "capacity", "timeline"],
    fieldOverrides: {
      decision_maker: {
        label: "Buyer",
        prompt: "Who places the order?",
        placeholder: "Name and role — e.g. Procurement manager",
        gapLabel: "Buyer not identified",
        whyItMatters: "A quote only moves when it reaches the person who can order.",
        recommendedAction: "Record who places the order",
      },
      capacity: {
        label: "Quantity or size",
        prompt: "What quantity or size is needed, and any key specification?",
        placeholder: "e.g. 40 t/month biochar (EBC grade), or dryer for 2 t/h",
        gapLabel: "Quantity or size not confirmed",
        whyItMatters: "We cannot quote without quantity or size.",
        recommendedAction: "Confirm quantity or size and key specification",
        priority: "high",
      },
      timeline: {
        label: "Needed by",
        prompt: "When does the customer need it?",
        placeholder: "e.g. First delivery March 2027",
        gapLabel: "Delivery date unknown",
        whyItMatters: "Delivery date sets lead time, price and urgency.",
        recommendedAction: "Confirm required delivery date",
        priority: "high",
      },
    },
    viabilityDimensionIds: [
      "decision_readiness",
      "competitive_position",
      "commercial_momentum",
      "strategic_value",
      "resource_efficiency",
    ],
    fatalFlawIds: ["commercial_stall"],
    engagementGap: false,
    offeringQuestionLimit: 1,
    projectInvestigation: false,
  },
  consulting: {
    motion: "consulting",
    label: "Consulting sale",
    process: "Agree scope → agree fee → deliver → follow-on project",
    depth: "minimal",
    understandingFieldIds: ["decision_maker", "business_case_strength", "budget", "timeline"],
    fieldOverrides: {
      decision_maker: {
        label: "Buyer",
        prompt: "Who approves the engagement?",
        placeholder: "Name and role — e.g. Head of Development",
        gapLabel: "Buyer not identified",
        whyItMatters: "A proposal only moves when it reaches the person who can sign it.",
        recommendedAction: "Record who approves the engagement",
      },
      business_case_strength: {
        label: "Scope",
        prompt: "What does the customer need assessed or delivered?",
        placeholder: "e.g. Feasibility study for a 5 t/h plant",
        gapLabel: "Scope not defined",
        whyItMatters: "A fee can only be set against a defined scope.",
        recommendedAction: "Agree the scope and deliverables",
      },
      budget: {
        label: "Fee",
        prompt: "Is there a budget for this engagement?",
        placeholder: "e.g. €30–50k study budget approved",
        gapLabel: "Fee not agreed",
        whyItMatters: "Paid work needs an agreed fee before effort is spent.",
        recommendedAction: "Agree the fee before starting work",
      },
      timeline: {
        label: "Needed by",
        prompt: "When must the work start or finish?",
        placeholder: "e.g. Report needed before Q4 board meeting",
        gapLabel: "Delivery date unknown",
        whyItMatters: "Start and delivery dates set resourcing and price.",
        recommendedAction: "Confirm start and delivery dates",
      },
    },
    viabilityDimensionIds: [
      "buying_drivers",
      "financial_readiness",
      "decision_readiness",
      "competitive_position",
      "commercial_momentum",
      "strategic_value",
      "resource_efficiency",
    ],
    fatalFlawIds: ["commercial_stall"],
    engagementGap: true,
    offeringQuestionLimit: 2,
    projectInvestigation: false,
  },
};

export const UNCLASSIFIED_SALES_MOTION_LABEL = "Sales type not set";

/** Offerings that make the sale a plant: the reactor is the core of any pyrolysis system. */
const PLANT_CORE_OFFERING_IDS = ["prod-pyrolysis-reactor"];

/**
 * Sales motion from offerings in scope (single source of truth — no second field to keep in sync).
 * A complete system or the pyrolysis reactor → system. Other products (a dryer, biochar) → product.
 * Services only → consulting. No offerings → unclassified (Reality First).
 */
export function resolveSalesMotion(
  pipeline: Pick<PipelineRow, "offeringIds">,
): ResolvedSalesMotion {
  const offerings = resolveOfferings(pipeline.offeringIds);
  if (offerings.length === 0) {
    return {
      motion: null,
      label: UNCLASSIFIED_SALES_MOTION_LABEL,
      reason: "No offerings selected — select what we are selling to set the sales type.",
    };
  }

  const motion: SalesMotion = offerings.some(
    (o) => o.category === "system" || PLANT_CORE_OFFERING_IDS.includes(o.id),
  )
    ? "system"
    : offerings.some((o) => o.category === "product")
      ? "product"
      : "consulting";

  const names = offerings.map((o) => o.name).join(", ");
  return {
    motion,
    label: SALES_MOTION_PROFILES[motion].label,
    reason: `Set by offerings in scope: ${names}.`,
  };
}

/** Profile for the deal, or `null` while unclassified (callers keep full investigation). */
export function salesMotionProfileFor(
  pipeline: Pick<PipelineRow, "offeringIds">,
): SalesMotionProfile | null {
  const { motion } = resolveSalesMotion(pipeline);
  return motion ? SALES_MOTION_PROFILES[motion] : null;
}

/** True for product / consulting — the lean, transactional processes. */
export function isLeanSalesMotion(profile: SalesMotionProfile | null): boolean {
  return profile?.depth === "minimal";
}

/** Understanding fields that apply to this deal, with motion-specific wording. */
export function understandingFieldsForPipeline(
  pipeline: Pick<PipelineRow, "offeringIds">,
): UnderstandingFieldDefinition[] {
  const profile = salesMotionProfileFor(pipeline);
  if (!profile || profile.motion === "system") return UNDERSTANDING_FIELDS;

  const allowed = new Set<UnderstandingFieldId>(profile.understandingFieldIds);
  return UNDERSTANDING_FIELDS.filter((field) => allowed.has(field.id)).map((field) => ({
    ...field,
    ...profile.fieldOverrides[field.id],
  }));
}
