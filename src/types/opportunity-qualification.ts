/**
 * Opportunity Qualification Engine — StandardBio
 * Prioritizes opportunities by machinery, engineering, paid consulting and project development potential.
 */

export type OpportunityQualificationTier = "A" | "B" | "C" | "D";

export const QUALIFICATION_TIER_META: Record<
  OpportunityQualificationTier,
  { label: string; description: string; color: string }
> = {
  A: {
    label: "Tier A",
    description: "Funded project · known decision makers · strong business case · near-term",
    color: "text-green-700",
  },
  B: {
    label: "Tier B",
    description: "Promising project · requirements emerging · medium-term",
    color: "text-upcycle-orange",
  },
  C: {
    label: "Tier C",
    description: "Early-stage · requires development",
    color: "text-amber-700",
  },
  D: {
    label: "Tier D",
    description: "Information seeker · low commitment · no visible business case",
    color: "text-carbon-blue/45",
  },
};

export type QualificationDimensionId =
  | "project_maturity"
  | "budget_availability"
  | "decision_maker_access"
  | "feedstock_availability"
  | "business_case_potential"
  | "funding_availability"
  | "technical_fit"
  | "geographical_fit"
  | "strategic_fit"
  | "competitive_position"
  | "timeline"
  | "relationship_strength";

export const QUALIFICATION_DIMENSION_LABELS: Record<QualificationDimensionId, string> = {
  project_maturity: "Project Maturity",
  budget_availability: "Budget Availability",
  decision_maker_access: "Decision Maker Access",
  feedstock_availability: "Feedstock Availability",
  business_case_potential: "Business Case Potential",
  funding_availability: "Funding Availability",
  technical_fit: "Technical Fit",
  geographical_fit: "Geographical Fit",
  strategic_fit: "Strategic Fit",
  competitive_position: "Competitive Position",
  timeline: "Timeline",
  relationship_strength: "Relationship Strength",
};

export type QualificationDimensionScore = {
  id: QualificationDimensionId;
  label: string;
  score: number;
  summary: string;
};

export type QualificationCommercialPotential =
  | "machinery_sale"
  | "engineering_contract"
  | "paid_consulting"
  | "project_development"
  | "mixed";

export const QUALIFICATION_COMMERCIAL_POTENTIAL_LABELS: Record<
  QualificationCommercialPotential,
  string
> = {
  machinery_sale: "Machinery sale",
  engineering_contract: "Engineering contract",
  paid_consulting: "Paid consulting",
  project_development: "Project development",
  mixed: "Mixed commercial path",
};

export type QualificationPriority = "critical" | "high" | "medium" | "low";

export type PaidServiceSignal = {
  detected: boolean;
  triggers: string[];
  recommendation: string;
  rationale: string;
};

export type OpportunityQualification = {
  dealId: string;
  dealName: string;
  qualificationScore: number;
  tier: OpportunityQualificationTier;
  tierDescription: string;
  recommendedAction: string;
  actionReason: string;
  actionOwner: string;
  actionWhen: string;
  expectedOutcome: string;
  confidencePercent: number;
  priority: QualificationPriority;
  commercialPotential: QualificationCommercialPotential;
  commercialPotentialLabel: string;
  paidService: PaidServiceSignal;
  dimensions: QualificationDimensionScore[];
  discourageUnpaidConsulting: boolean;
  href: string;
};

export type OpportunityQualificationBrief = Pick<
  OpportunityQualification,
  | "dealId"
  | "dealName"
  | "qualificationScore"
  | "tier"
  | "recommendedAction"
  | "actionReason"
  | "expectedOutcome"
  | "confidencePercent"
  | "commercialPotentialLabel"
  | "href"
>;
