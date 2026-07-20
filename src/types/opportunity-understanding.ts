/** Phase 2.6B — Opportunity Understanding Capture model */

export type UnderstandingCategory =
  | "commercial"
  | "technical"
  | "feedstock"
  | "business_case"
  | "infrastructure"
  | "stakeholders";

export const UNDERSTANDING_CATEGORIES: UnderstandingCategory[] = [
  "commercial",
  "technical",
  "feedstock",
  "business_case",
  "infrastructure",
  "stakeholders",
];

export const UNDERSTANDING_CATEGORY_LABELS: Record<UnderstandingCategory, string> = {
  commercial: "Commercial",
  technical: "Technical",
  feedstock: "Feedstock",
  business_case: "Business Case",
  infrastructure: "Infrastructure",
  stakeholders: "Stakeholders",
};

export type UnderstandingFieldId =
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
  | "stakeholder_map";

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
];

export const UNDERSTANDING_FIELD_BY_ID = Object.fromEntries(
  UNDERSTANDING_FIELDS.map((field) => [field.id, field]),
) as Record<UnderstandingFieldId, UnderstandingFieldDefinition>;

/** User-captured answers — source of truth for opportunity understanding. */
export type OpportunityUnderstandingCapture = {
  fields: Partial<Record<UnderstandingFieldId, string>>;
  updatedAt?: string;
};

export function isUnderstandingFieldId(value: string | null | undefined): value is UnderstandingFieldId {
  return Boolean(value && value in UNDERSTANDING_FIELD_BY_ID);
}

export function fieldsForCategory(
  category: UnderstandingCategory,
): UnderstandingFieldDefinition[] {
  return UNDERSTANDING_FIELDS.filter((field) => field.category === category);
}
