/** Phase 2.6B — Opportunity Understanding Capture model */

import type { SourceFinding } from "@/lib/source-findings";
import type { QueryPack } from "@/types/query-pack";

export type UnderstandingCategory =
  | "customer"
  | "commercial"
  | "technical"
  | "feedstock"
  | "business_case"
  | "infrastructure"
  | "stakeholders";

export const UNDERSTANDING_CATEGORIES: UnderstandingCategory[] = [
  "customer",
  "commercial",
  "technical",
  "feedstock",
  "business_case",
  "infrastructure",
  "stakeholders",
];

export const UNDERSTANDING_CATEGORY_LABELS: Record<UnderstandingCategory, string> = {
  customer: "Customer",
  commercial: "Commercial",
  technical: "Technical",
  feedstock: "Feedstock",
  business_case: "Business Case",
  infrastructure: "Infrastructure",
  stakeholders: "Stakeholders",
};

export type UnderstandingFieldId =
  | "customer_problem"
  | "why_now"
  | "customer_vision"
  | "customer_value"
  | "decision_maker"
  | "economic_buyer"
  | "offtake_strategy"
  | "budget"
  | "timeline"
  | "end_product"
  | "capacity"
  | "technical_fit"
  | "feedstock_volume"
  | "feedstock_quality"
  | "business_case_strength"
  | "funding_source"
  | "utilities"
  | "site_readiness"
  | "permitting"
  | "stakeholder_map"
  | "feedstock_agreement"
  | "public_funding";

/** Asked only on Build-Own-Operate deals (FS-005B). */
export const BOO_ONLY_FIELD_IDS: readonly UnderstandingFieldId[] = [
  "feedstock_agreement",
  "public_funding",
];

export type UnderstandingFieldDefinition = {
  id: UnderstandingFieldId;
  category: UnderstandingCategory;
  label: string;
  /** Short prompt shown above the input */
  prompt: string;
  placeholder: string;
  /** Gap headline when empty */
  gapLabel: string;
  whyItMatters: string;
  recommendedAction: string;
  priority: "high" | "medium" | "low";
};

/**
 * Canonical understanding fields — gaps are derived from these.
 * Users answer here; they never enter the same fact twice.
 */
export const UNDERSTANDING_FIELDS: UnderstandingFieldDefinition[] = [
  {
    id: "customer_problem",
    category: "customer",
    label: "Customer problem",
    prompt: "What is the customer trying to fix, and who feels it?",
    placeholder: "In their words — e.g. Waste disposal cost is rising; plant manager wants it solved",
    gapLabel: "Customer problem not confirmed",
    whyItMatters:
      "Without a confirmed problem, every next step is a guess and the deal can stall without warning.",
    recommendedAction: "Ask the customer to describe the problem in their own words and record who feels it",
    priority: "high",
  },
  {
    id: "why_now",
    category: "customer",
    label: "Why now",
    prompt: "What forces a decision, and by when?",
    placeholder: "e.g. Landfill ban from 2027; funding call closes in March",
    gapLabel: "No reason to act now",
    whyItMatters:
      "Deals without a reason to decide drift. A deadline or event is what turns interest into a decision.",
    recommendedAction: "Find the event, deadline or funding window that makes this urgent for the customer",
    priority: "high",
  },
  {
    id: "customer_vision",
    category: "customer",
    label: "What they picture",
    prompt: "What does a good outcome look like to the customer?",
    placeholder: "e.g. Waste processed on site, no transport, heat reused in the plant",
    gapLabel: "Customer's picture of a good outcome unknown",
    whyItMatters:
      "A proposal that does not match what the customer pictures is rejected even when it is technically sound.",
    recommendedAction: "Ask what a successful result would look like and write it down in their terms",
    priority: "medium",
  },
  {
    id: "customer_value",
    category: "customer",
    label: "What it is worth to them",
    prompt: "What does the problem cost, or the solution gain, in the customer's own terms?",
    placeholder: "e.g. About €400k a year in disposal fees (stated by CFO); optional amount",
    gapLabel: "Value to the customer not stated",
    whyItMatters:
      "If the customer has not put a value on the problem, price will be the only thing they compare.",
    recommendedAction: "Ask what the problem costs today and what solving it would be worth",
    priority: "medium",
  },
  {
    id: "decision_maker",
    category: "stakeholders",
    label: "Decision Maker",
    prompt: "Who owns the go / no-go decision?",
    placeholder: "Name and role — e.g. Thea, Plant Manager",
    gapLabel: "Decision Maker not identified",
    whyItMatters: "Without a decision maker, proposals stall and alignment cannot be tested.",
    recommendedAction: "Record who owns the decision and how approval flows",
    priority: "high",
  },
  {
    id: "economic_buyer",
    category: "stakeholders",
    label: "Economic Buyer",
    prompt: "Who holds budget authority?",
    placeholder: "Name and role — e.g. CFO or CAPEX committee sponsor",
    gapLabel: "Economic Buyer not confirmed",
    whyItMatters: "Commercial proposals need a budget owner — otherwise investment authority stays unclear.",
    recommendedAction: "Confirm who holds budget authority and signs off on CAPEX",
    priority: "high",
  },
  {
    id: "stakeholder_map",
    category: "stakeholders",
    label: "Stakeholder Map",
    prompt: "Who else influences this opportunity?",
    placeholder: "Key technical, commercial, and executive contacts",
    gapLabel: "Stakeholder map incomplete",
    whyItMatters: "Hidden influencers can block progress even when technical fit looks strong.",
    recommendedAction: "Map technical, commercial, and executive sponsors",
    priority: "medium",
  },
  {
    id: "offtake_strategy",
    category: "commercial",
    label: "Offtake Strategy",
    prompt: "How will the end product be used or sold?",
    placeholder: "e.g. On-site use, offtake partner, carbon credits",
    gapLabel: "Offtake strategy unclear",
    whyItMatters: "Without offtake clarity, the business case and project economics remain unproven.",
    recommendedAction: "Clarify end product path and offtake commitments",
    priority: "high",
  },
  {
    id: "budget",
    category: "commercial",
    label: "Budget",
    prompt: "What budget range or investment appetite exists?",
    placeholder: "e.g. €2–3M CAPEX envelope, or study budget only",
    gapLabel: "Budget not validated",
    whyItMatters: "Unvalidated budget means deal size and investment appetite are still assumptions.",
    recommendedAction: "Confirm budget range, funding source, and approval thresholds",
    priority: "high",
  },
  {
    id: "timeline",
    category: "commercial",
    label: "Timeline",
    prompt: "When must a decision or start-up happen?",
    placeholder: "e.g. Investment decision Q4 2026; plant online 2028",
    gapLabel: "Decision timeline unknown",
    whyItMatters: "Without a timeline, urgency and resource planning stay guesswork.",
    recommendedAction: "Confirm decision date and critical path milestones",
    priority: "medium",
  },
  {
    id: "end_product",
    category: "technical",
    label: "End Product",
    prompt: "What output is the customer targeting?",
    placeholder: "e.g. Biochar, heat, materials, mixed products",
    gapLabel: "End product not confirmed",
    whyItMatters: "Product intent drives system design, offtake, and commercial packaging.",
    recommendedAction: "Confirm the primary end product with the customer",
    priority: "high",
  },
  {
    id: "capacity",
    category: "technical",
    label: "Capacity",
    prompt: "What capacity is required?",
    placeholder: "e.g. 1,200 kg/h or 8,000 t/year",
    gapLabel: "Capacity requirement unknown",
    whyItMatters: "Capacity drives reactor sizing, utilities, and commercial value.",
    recommendedAction: "Confirm target throughput with technical stakeholders",
    priority: "medium",
  },
  {
    id: "technical_fit",
    category: "technical",
    label: "Technical Fit",
    prompt: "Does Standard Bio technology fit this application?",
    placeholder: "Known fit notes, open risks, or validation needed",
    gapLabel: "Technical fit not validated",
    whyItMatters: "Poor technical fit wastes engineering time and erodes trust.",
    recommendedAction: "Capture fit assessment and open technical risks",
    priority: "medium",
  },
  {
    id: "feedstock_volume",
    category: "feedstock",
    label: "Feedstock Volume",
    prompt: "What annual volume is realistically available?",
    placeholder: "e.g. 25,000 t/year HDPE regrind",
    gapLabel: "Feedstock volume not confirmed",
    whyItMatters: "Technical and commercial design depend on realistic feedstock availability.",
    recommendedAction: "Confirm annual volume with the customer or supplier",
    priority: "high",
  },
  {
    id: "feedstock_quality",
    category: "feedstock",
    label: "Feedstock Quality",
    prompt: "What quality, moisture, and contamination limits apply?",
    placeholder: "e.g. Moisture <2%, sorted HDPE, low PVC",
    gapLabel: "Feedstock quality not confirmed",
    whyItMatters: "Quality variance can invalidate process design and offtake specs.",
    recommendedAction: "Confirm quality specs and variance with technical stakeholders",
    priority: "high",
  },
  {
    id: "business_case_strength",
    category: "business_case",
    label: "Business Case",
    prompt: "Why will the customer invest?",
    placeholder: "e.g. Waste cost reduction, carbon credits, energy recovery",
    gapLabel: "Business case not articulated",
    whyItMatters: "Without a clear why-buy, proposals lack commercial traction.",
    recommendedAction: "Capture the customer’s investment rationale",
    priority: "high",
  },
  {
    id: "funding_source",
    category: "business_case",
    label: "Funding Source",
    prompt: "How will the project be funded?",
    placeholder: "e.g. Balance sheet, grant, project finance, partner equity",
    gapLabel: "Funding source unclear",
    whyItMatters: "Funding path determines timeline realism and deal structure.",
    recommendedAction: "Confirm funding source and any grant or financing constraints",
    priority: "medium",
  },
  {
    id: "utilities",
    category: "infrastructure",
    label: "Utilities",
    prompt: "What site utilities and capacity are available?",
    placeholder: "e.g. Power, steam, water, grid connection status",
    gapLabel: "Site utilities not confirmed",
    whyItMatters: "Site constraints can invalidate capacity assumptions and feasibility.",
    recommendedAction: "Validate utility capacity at the proposed site",
    priority: "medium",
  },
  {
    id: "site_readiness",
    category: "infrastructure",
    label: "Site Readiness",
    prompt: "Is the site ready for installation?",
    placeholder: "e.g. Civil works status, access, layout constraints",
    gapLabel: "Site readiness unknown",
    whyItMatters: "Installation windows slip when site readiness is assumed.",
    recommendedAction: "Confirm site readiness and critical path for civil works",
    priority: "medium",
  },
  {
    id: "permitting",
    category: "infrastructure",
    label: "Permitting",
    prompt: "What is the permitting pathway and status?",
    placeholder: "e.g. Environmental assessment started; expected permit date",
    gapLabel: "Permitting pathway unclear",
    whyItMatters: "Permitting delays are a common source of project failure and timeline slip.",
    recommendedAction: "Review permitting status and environmental constraints",
    priority: "high",
  },
  {
    id: "feedstock_agreement",
    category: "feedstock",
    label: "Feedstock Agreement",
    prompt: "Is there an agreement for the feedstock, and on what terms?",
    placeholder: "e.g. Heads of terms signed; 10 years; gate fee per ton; volume commitment",
    gapLabel: "No feedstock agreement confirmed",
    whyItMatters: "Without committed feedstock there is no plant to finance.",
    recommendedAction: "Agree feedstock volume, term and price with the supplier",
    priority: "high",
  },
  {
    id: "public_funding",
    category: "business_case",
    label: "Public Funding and Subsidies",
    prompt: "Which grants or subsidies apply, and where does each stand?",
    placeholder: "e.g. Scheme named, application date, decision date — or 'none planned'",
    gapLabel: "Public funding not confirmed",
    whyItMatters: "Grants and subsidies can decide whether the plant is financeable.",
    recommendedAction: "Identify applicable schemes and record application status",
    priority: "medium",
  },
];

export const UNDERSTANDING_FIELD_BY_ID = Object.fromEntries(
  UNDERSTANDING_FIELDS.map((field) => [field.id, field]),
) as Record<UnderstandingFieldId, UnderstandingFieldDefinition>;

/** User-captured answers — source of truth for opportunity understanding. */
export type OpportunityUnderstandingCapture = {
  fields: Partial<Record<UnderstandingFieldId, string>>;
  /**
   * Free-text answers for discovery questions that are not formal understanding fields
   * (e.g. offerings scope, ad-hoc discovery prompts).
   */
  discoveryNotes?: Record<string, string>;
  /** Public-source and user notes added via Add a finding. */
  findings?: SourceFinding[];
  /** FS-024 Opportunity / Project Query Pack (current pack). */
  queryPack?: QueryPack;
  updatedAt?: string;
};

export function isUnderstandingFieldId(value: string | null | undefined): value is UnderstandingFieldId {
  return Boolean(value && Object.hasOwn(UNDERSTANDING_FIELD_BY_ID, value));
}

export function fieldsForCategory(
  category: UnderstandingCategory,
): UnderstandingFieldDefinition[] {
  return UNDERSTANDING_FIELDS.filter((field) => field.category === category);
}
