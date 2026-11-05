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
import { BOO_ONLY_FIELD_IDS, UNDERSTANDING_FIELDS } from "@/types/opportunity-understanding";
import { isSalesMotion } from "@/types/sales-motion";
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
    understandingFieldIds: UNDERSTANDING_FIELDS.map((field) => field.id).filter(
      (id) => !BOO_ONLY_FIELD_IDS.includes(id),
    ),
    fieldOverrides: {},
    viabilityDimensionIds: [...ALL_VIABILITY_DIMENSIONS],
    fatalFlawIds: [...ALL_FATAL_FLAWS],
    engagementGap: true,
    offeringQuestionLimit: 3,
    projectInvestigation: true,
  },
  // FS-005B — Standard Bio develops the plant project (BOO, JV, or co-owned SPV).
  // How final ownership and financing end up is decided along the way; customer CAPEX budget is not asked.
  boo: {
    motion: "boo",
    label: "Project development (BOO / JV)",
    process:
      "Secure offtake, feedstock and site → permit → agree ownership & financing → financial close",
    depth: "full",
    understandingFieldIds: UNDERSTANDING_FIELDS.map((field) => field.id).filter(
      (id) => id !== "economic_buyer" && id !== "budget",
    ),
    fieldOverrides: {
      customer_problem: {
        label: "What they need solved",
        prompt: "What does the supplier or host need solved, and who feels it?",
        placeholder: "e.g. Digestate disposal cost and limits on spreading",
        gapLabel: "Their problem not confirmed",
        whyItMatters: "An agreement only holds if it solves something they feel.",
        recommendedAction: "Ask them to describe the problem in their own words",
      },
      customer_value: {
        label: "What it is worth to them",
        prompt: "What does solving it save or earn them, such as disposal cost avoided or energy value?",
        gapLabel: "Value to them not stated",
        whyItMatters: "Agreements on price and term depend on what the problem costs them today.",
        recommendedAction: "Ask what the problem costs them today",
      },
      decision_maker: {
        label: "Who signs the agreements",
        prompt: "Who can sign the feedstock, energy and site agreements?",
        placeholder: "Name and role — e.g. Plant owner",
        gapLabel: "Signatory not identified",
        whyItMatters: "Agreements stall when the person who can sign has not been engaged.",
        recommendedAction: "Identify who signs and engage them",
      },
      feedstock_volume: {
        prompt: "What volume is committed, and for how long?",
        gapLabel: "Committed volume unknown",
        whyItMatters: "Committed volume sets plant size and what investors will fund.",
        recommendedAction: "Confirm committed volume and contract term",
      },
      site_readiness: {
        label: "Site control (land plot)",
        prompt:
          "Is a land plot available, and have we decided and secured rent/lease vs. ownership and access?",
        placeholder:
          "e.g. Plot available next to host plant; rent/lease vs. purchase and terms to be determined",
        gapLabel: "Land plot rent or ownership not yet secured",
        whyItMatters:
          "Even when a plot is available, we cannot permit or finance a plant until land lease or ownership terms are agreed.",
        recommendedAction: "Agree and secure lease/rent or purchase terms for the land plot",
        priority: "high",
      },
      utilities: {
        label: "Shared utilities",
        prompt:
          "Which utilities and tie-ins (heat, power, water, logistics) are needed with the neighbouring plant, and are they secured?",
        placeholder: "e.g. Heat exchange ducts/piping, power and water capacity — terms to be secured",
        gapLabel: "Utilities and tie-ins not yet secured",
        whyItMatters: "Shared infrastructure and utility capacity can make or break the plant's economics.",
        recommendedAction: "Confirm utility capacity and secure shared utility terms with the neighbour",
        priority: "high",
      },
      offtake_strategy: {
        label: "Energy and heat offtake",
        prompt: "Who will buy the surplus thermal energy (heat/steam/power), on what terms and price?",
        placeholder: "e.g. Vest Biogas buys ~7–8 GWh/year thermal heat for drying; tariff and term",
        gapLabel: "Energy / heat offtake not agreed",
        whyItMatters: "Without a committed buyer for the surplus thermal energy, the local heat revenue is a guess.",
        recommendedAction: "Agree thermal energy volume, price and contract term with the host",
        priority: "high",
      },
      end_product: {
        label: "Biochar product offtake",
        prompt: "How will Standard Bio secure offtake for the biochar product (buyers, spec, volume, price, carbon credits)?",
        placeholder: "e.g. Biochar from wood chips — offtake buyers, price per ton and carbon credit route to be secured",
        gapLabel: "Biochar product offtake not secured",
        whyItMatters: "Biochar (and carbon removal value) is a core revenue stream of the plant and must have secured offtake.",
        recommendedAction: "Secure biochar offtake buyers, specifications and pricing",
        priority: "high",
      },
      funding_source: {
        label: "Ownership and financing",
        prompt:
          "How will ownership and financing be structured (BOO, JV with partner, investors, project finance)?",
        placeholder: "e.g. To be discussed — evaluating SB BOO vs. JV with host and project finance",
        gapLabel: "Ownership and financing not yet decided",
        whyItMatters:
          "The ownership and financing structure determines who carries capital and how returns are shared.",
        recommendedAction:
          "Discuss and agree the ownership and financing model with the partner and investors",
        priority: "high",
      },
    },
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
  pipeline: Pick<PipelineRow, "offeringIds" | "dealModel">,
): ResolvedSalesMotion {
  // FS-005B 4.1 — the user's choice always wins.
  if (isSalesMotion(pipeline.dealModel)) {
    return {
      motion: pipeline.dealModel,
      source: "chosen",
      label: SALES_MOTION_PROFILES[pipeline.dealModel].label,
      reason: "Chosen on this opportunity.",
    };
  }

  const offerings = resolveOfferings(pipeline.offeringIds);
  if (offerings.length === 0) {
    return {
      motion: null,
      source: "none",
      label: UNCLASSIFIED_SALES_MOTION_LABEL,
      reason: "No offerings selected — select what we are selling to set the sales type.",
    };
  }

  // The offerings guess never selects Build-Own-Operate; only the user does.
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
    source: "offerings",
    label: SALES_MOTION_PROFILES[motion].label,
    reason: `Assumed from offerings in scope: ${names}.`,
  };
}
/** Profile for the deal, or `null` while unclassified (callers keep full investigation). */
export function salesMotionProfileFor(
  pipeline: Pick<PipelineRow, "offeringIds" | "dealModel">,
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
  pipeline: Pick<PipelineRow, "offeringIds" | "dealModel">,
): UnderstandingFieldDefinition[] {
  const profile = salesMotionProfileFor(pipeline);
  // Unclassified keeps the full investigation, minus the Build-Own-Operate-only fields.
  if (!profile) {
    return UNDERSTANDING_FIELDS.filter((field) => !BOO_ONLY_FIELD_IDS.includes(field.id));
  }

  const allowed = new Set<UnderstandingFieldId>(profile.understandingFieldIds);
  return UNDERSTANDING_FIELDS.filter((field) => allowed.has(field.id)).map((field) => ({
    ...field,
    ...profile.fieldOverrides[field.id],
  }));
}
