import type { PipelineRow } from "@/types/pipeline";
import type {
  ResolvedSalesMotion,
  SalesMotion,
  SalesMotionProfile,
} from "@/types/sales-motion";
import type {
  UnderstandingFieldDefinition,
} from "@/types/opportunity-understanding";
import {
  BOO_ONLY_FIELD_IDS,
  UNDERSTANDING_FIELD_BY_ID,
  UNDERSTANDING_FIELDS,
} from "@/types/opportunity-understanding";
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
  // FS-005B — Standard Bio develops its own plant project (FEL 1 to realisation: BOO, JV, or SPV).
  // Counterparties (such as Antec / Vest Biogas buying thermal heat) are offtakers, suppliers, or hosts —
  // not buyers of the plant. We investigate our own project across the 7 development pillars rather than
  // a customer's plant-buying problem or CAPEX budget.
  boo: {
    motion: "boo",
    label: "Project development (BOO / JV)",
    process:
      "FEL 1 → Realisation: secure land plot, feedstock, utilities, energy & biochar offtake, subsidies and permitting → financial close",
    depth: "full",
    understandingFieldIds: [
      "site_readiness",
      "feedstock_agreement",
      "utilities",
      "offtake_strategy",
      "end_product",
      "public_funding",
      "permitting",
      "funding_source",
      "decision_maker",
      "feedstock_volume",
      "feedstock_quality",
      "capacity",
      "technical_fit",
      "business_case_strength",
      "timeline",
      "why_now",
      "stakeholder_map",
    ],
    fieldOverrides: {
      site_readiness: {
        label: "Secure land plot",
        prompt:
          "Is a land plot available, and have we decided and secured rent/lease vs. ownership and access?",
        placeholder:
          "e.g. Plot (~80 x 120 m²) next to host plant; rent/lease vs. purchase terms and access to be secured",
        gapLabel: "Land plot not yet secured",
        whyItMatters:
          "Even when a plot is identified, we cannot permit, finance, or build our project until land lease or ownership terms are secured.",
        recommendedAction: "Agree and secure lease/rent or purchase terms for the land plot",
        priority: "high",
      },
      feedstock_agreement: {
        label: "Secure feedstock",
        prompt:
          "Have we secured feedstock supply for our plant (supplier, volume, moisture/quality spec, price, and term)?",
        placeholder:
          "e.g. 8,000–10,000 t/yr G30 wood chips — supplier agreement, moisture spec, storage and price to be secured",
        gapLabel: "Feedstock supply not yet secured",
        whyItMatters:
          "Without a secured feedstock supply agreement there is no project to finance or build.",
        recommendedAction: "Agree feedstock volume, moisture/quality spec, term and price with the supplier",
        priority: "high",
      },
      utilities: {
        label: "Secure required utilities",
        prompt:
          "Which utilities and tie-ins (heat, power, water, logistics) are required for our project, and are they secured?",
        placeholder: "e.g. Heat exchange ducts/piping, power and water capacity — tie-in terms to be secured",
        gapLabel: "Required utilities not yet secured",
        whyItMatters: "Required utilities and tie-in capacity can make or break the project's engineering and economics.",
        recommendedAction: "Confirm utility capacity and secure required utility tie-in terms",
        priority: "high",
      },
      offtake_strategy: {
        label: "Secure energy offtake",
        prompt: "Who will buy the surplus energy (e.g. thermal heat/steam/power), and have we secured volume, price, and term?",
        placeholder: "e.g. Antec / Vest Biogas buys ~7–8 GWh/year thermal heat for drying — tariff and contract term to be secured",
        gapLabel: "Energy offtake not yet secured",
        whyItMatters: "Without a committed energy/heat offtake agreement, local thermal energy revenue for our project is a guess.",
        recommendedAction: "Agree thermal energy volume, price and contract term with the energy offtaker",
        priority: "high",
      },
      end_product: {
        label: "Secure product offtake (biochar)",
        prompt: "How will Standard Bio secure offtake for the biochar product from pyrolysis (buyers, spec, volume, price, carbon credits)?",
        placeholder: "e.g. Biochar from pyrolysis — offtake buyers, product spec, price per ton and carbon credit route to be secured",
        gapLabel: "Product offtake (biochar) not yet secured",
        whyItMatters: "Biochar (and carbon removal value) is a core revenue stream of our plant and must have secured offtake.",
        recommendedAction: "Secure biochar product offtake buyers, specifications and pricing",
        priority: "high",
      },
      public_funding: {
        label: "Secure subsidies (if we qualify)",
        prompt: "Do we qualify for public subsidies or grants, and where does each application stand?",
        placeholder: "e.g. Qualify for Enova / Innovation Norway subsidies — eligibility, application and grant status",
        gapLabel: "Subsidies not yet secured",
        whyItMatters: "Public subsidies and grants can decide whether our development project is financeable from FEL 1 to realisation.",
        recommendedAction: "Confirm subsidy qualification and prepare/submit grant applications",
        priority: "high",
      },
      permitting: {
        label: "Secure permitting",
        prompt: "Which permits are needed for our pyrolysis plant and auxiliary equipment, and where does each stand?",
        placeholder: "e.g. Separate permit required for Standard Bio pyrolysis plant and dryer — authority and application status",
        gapLabel: "Permitting not yet secured",
        whyItMatters: "Without environmental and building permits, our development project cannot be financed or built.",
        recommendedAction: "Confirm required permits, submit applications, and secure permitting approval",
        priority: "high",
      },
      funding_source: {
        label: "Ownership and financing",
        prompt:
          "How will ownership and financing be structured from FEL 1 to realisation (BOO, JV with partner, investors, project finance)?",
        placeholder: "e.g. To be discussed — evaluating SB BOO vs. JV with partner and project finance",
        gapLabel: "Ownership and financing not yet decided",
        whyItMatters:
          "The ownership and financing structure determines who carries capital and how returns are shared at realisation.",
        recommendedAction:
          "Discuss and agree the ownership and financing model with partners and investors",
        priority: "high",
      },
      decision_maker: {
        label: "Who signs the agreements",
        prompt: "Who signs the land plot, feedstock, utility, and energy offtake agreements?",
        placeholder: "Name and role — e.g. Host plant CEO/CFO, landowner, feedstock supplier MD",
        gapLabel: "Signatory not identified",
        whyItMatters: "Project agreements stall when the people who can sign have not been engaged.",
        recommendedAction: "Identify who signs each project agreement and engage them",
      },
      feedstock_volume: {
        prompt: "What annual feedstock volume is committed for our plant, and for how long?",
        gapLabel: "Committed feedstock volume unknown",
        whyItMatters: "Committed feedstock volume sets plant sizing and what investors will finance.",
        recommendedAction: "Confirm committed annual feedstock volume and contract term",
      },
      why_now: {
        label: "Project timing and drivers",
        prompt: "What drives the project schedule from FEL 1 to realisation, and what deadlines apply?",
        placeholder: "e.g. Host drying decision within 6 months; subsidy application window",
        gapLabel: "Project timing and deadlines not confirmed",
        whyItMatters: "Clear project milestones and external deadlines keep FEL progression and counterparty agreements on track.",
        recommendedAction: "Confirm key project deadlines and FEL gate schedule",
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

  return profile.understandingFieldIds
    .map((id) => UNDERSTANDING_FIELD_BY_ID[id])
    .filter((field): field is UnderstandingFieldDefinition => Boolean(field))
    .map((field) => ({
      ...field,
      ...profile.fieldOverrides[field.id],
    }));
}
