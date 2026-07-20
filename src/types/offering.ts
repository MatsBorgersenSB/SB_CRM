/** Standard Bio commercial offerings — what we sell, not CRM stage labels. */

export type OfferingCategory = "system" | "product" | "service";

export const OFFERING_CATEGORY_LABELS: Record<OfferingCategory, string> = {
  system: "Systems",
  product: "Products",
  service: "Services",
};

export const OFFERING_CATEGORIES: OfferingCategory[] = ["system", "product", "service"];

export type StandardBioOffering = {
  id: string;
  name: string;
  category: OfferingCategory;
  /** One-line commercial intent — what Standard Bio is selling. */
  summary: string;
  /** Facts SmartAssist needs before recommending commitment. */
  requiredInformation: string[];
  /** Stakeholder roles typically needed to advance this offering. */
  suggestedStakeholderRoles: string[];
  /** Discovery questions tailored to this offering. */
  discoveryQuestions: string[];
  /** Qualification signals SmartAssist looks for. */
  qualificationSignals: string[];
  /** Concrete next-best-action hints when this offering is in play. */
  nextBestActionHints: string[];
};

export type OpportunityOfferingSelection = {
  offeringIds: string[];
  offerings: StandardBioOffering[];
  byCategory: Record<OfferingCategory, StandardBioOffering[]>;
  labels: string[];
  hasSystems: boolean;
  hasProducts: boolean;
  hasServices: boolean;
  missingCategories: OfferingCategory[];
};
