/** Business advisor framing — advisor first, task manager second. */
export type BusinessImpactCategory =
  | "opportunity"
  | "relationship"
  | "commercial"
  | "crm_admin";

export type BusinessImpactPriority = "Critical" | "High" | "Medium" | "Low";

export type BusinessImpactRecommendation = {
  id: string;
  entityName: string;
  category: BusinessImpactCategory;
  situation: string;
  impact: string;
  recommendedAction: string;
  estimatedEffort: string;
  expectedOutcome: string;
  priority: BusinessImpactPriority;
  impactScore: number;
  href?: string;
  source: string;
};

export const BUSINESS_IMPACT_SECTIONS = [
  { id: "situation", label: "Situation" },
  { id: "impact", label: "Impact" },
  { id: "recommended_action", label: "Recommended Action" },
  { id: "estimated_effort", label: "Estimated Effort" },
  { id: "expected_outcome", label: "Expected Outcome" },
] as const;
