export type DeepResearchPriority = "low" | "medium" | "high";

export type DeepResearchKind =
  | "company"
  | "contact"
  | "competitor"
  | "market"
  | "technology"
  | "project";

export type DeepResearchSourceTag = "internal" | "external";

export type DeepResearchBullet = {
  id: string;
  label: string;
  detail?: string;
  href?: string;
  source: DeepResearchSourceTag;
};

export type DeepResearchExecutiveSummary = {
  subject: string;
  industry?: string;
  location?: string;
  size?: string;
  businessFocus: string;
  narrative: string;
};

export type DeepResearchBriefing = {
  id: string;
  kind: DeepResearchKind;
  query: string;
  generatedAt: string;
  subjectLabel: string;
  href?: string;
  executiveSummary: DeepResearchExecutiveSummary;
  whyItMatters: string[];
  knownRelationship: {
    activities: DeepResearchBullet[];
    opportunities: DeepResearchBullet[];
    projects: DeepResearchBullet[];
    contacts: DeepResearchBullet[];
    lastContact?: string;
    relationshipHealth?: string;
  };
  recentNews: DeepResearchBullet[];
  projectSignals: DeepResearchBullet[];
  risks: {
    commercial: DeepResearchBullet[];
    relationship: DeepResearchBullet[];
    competitive: DeepResearchBullet[];
  };
  opportunities: {
    applications: DeepResearchBullet[];
    revenuePaths: DeepResearchBullet[];
    salesOpportunities: DeepResearchBullet[];
  };
  recommendedActions: DeepResearchBullet[];
  overallAssessment: {
    priority: DeepResearchPriority;
    strategicPriority: string;
    summary: string;
  };
  sourcesUsed: string[];
};
