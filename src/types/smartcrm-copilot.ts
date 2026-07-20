export type CopilotSource = "rule" | "ai";

export type CopilotContext = "dashboard" | "company" | "opportunity" | "document";

export type CopilotSeverity = "critical" | "warning" | "info";

export type CopilotBriefItem = {
  id: string;
  label: string;
  detail: string;
  href?: string;
  severity?: CopilotSeverity;
};

export type CopilotRecommendation = {
  action: string;
  reason: string;
  priority: "High" | "Medium" | "Low";
  href?: string;
};

export type DailyBriefing = {
  kind: "daily";
  context: "dashboard";
  generatedAt: string;
  headline: string;
  relationshipsAttention: CopilotBriefItem[];
  opportunitiesAtRisk: CopilotBriefItem[];
  knowledgeRisks: CopilotBriefItem[];
  recommendedFocus: CopilotRecommendation[];
  source: CopilotSource;
};

export type CompanyCopilotSummary = {
  kind: "company";
  context: "company";
  generatedAt: string;
  headline: string;
  companyId: string;
  companyName: string;
  relationshipSummary: string;
  healthScore: number;
  healthStatus: string;
  risks: CopilotBriefItem[];
  openCommitments: CopilotBriefItem[];
  activityMemory: CopilotBriefItem[];
  recommendedActions: CopilotRecommendation[];
  source: CopilotSource;
};

export type OpportunityCopilotSummary = {
  kind: "opportunity";
  context: "opportunity";
  generatedAt: string;
  headline: string;
  portfolioMode: boolean;
  healthScore?: number;
  healthStatus?: string;
  winProbability?: number;
  momentum?: string;
  risks: CopilotBriefItem[];
  opportunitiesAtRisk: CopilotBriefItem[];
  recommendedActions: CopilotRecommendation[];
  source: CopilotSource;
};

export type DocumentCopilotSummary = {
  kind: "document";
  context: "document";
  generatedAt: string;
  headline: string;
  documentId: string;
  documentName: string;
  businessImpact: string;
  impactLevel: string;
  dependencies: CopilotBriefItem[];
  risks: CopilotBriefItem[];
  recommendations: CopilotRecommendation[];
  source: CopilotSource;
};

export type CopilotBriefing =
  | DailyBriefing
  | CompanyCopilotSummary
  | OpportunityCopilotSummary
  | DocumentCopilotSummary;

export type CopilotEnhancementProvider = (
  briefing: CopilotBriefing,
) => Promise<CopilotBriefing>;
