import type { CommercialViabilityBrief } from "@/types/commercial-viability";
import type { CoPilotActionProposal } from "@/types/smartassist-copilot";
import type { DeepResearchBriefing } from "@/types/deep-research";

export type SmartAssistIntelligenceLayerId = "operational" | "commercial";

export type SmartAssistIntelligenceLayer = {
  id: SmartAssistIntelligenceLayerId;
  label: string;
  description: string;
  focusAreas: string[];
};

export type SmartAssistSectionId =
  | "today"
  | "upcoming"
  | "follow_ups"
  | "opportunities"
  | "recommendations";

export type SmartAssistItem = {
  id: string;
  label: string;
  detail: string;
  href?: string;
  priority?: "critical" | "high" | "normal";
  emoji?: string;
};

export type SmartAssistMetricId =
  | "critical_opportunities"
  | "follow_ups_due"
  | "meetings_today"
  | "awaiting_response"
  | "open_commitments";

export type SmartAssistFocusMetrics = {
  criticalOpportunities: number;
  followUpsDue: number;
  meetingsToday: number;
  quotationsAwaiting: number;
  openCommitments: number;
  pendingCrmActions: number;
  pipelineValueLabel: string;
  recommendedFocus: string;
};

export type SmartAssistFocus = {
  greeting: string;
  generatedAt: string;
  metrics: SmartAssistFocusMetrics;
  sections: Record<SmartAssistSectionId, SmartAssistItem[]>;
  /** CRM Co-Pilot — recommended actions awaiting user approval */
  copilotProposals: CoPilotActionProposal[];
  /** Dual intelligence model: operational + commercial (CVM) */
  intelligenceLayers: SmartAssistIntelligenceLayer[];
  /** Top opportunities ranked by CVM */
  opportunityCoach: CommercialViabilityBrief[];
};

export type SmartAssistCommandIntent =
  | "schedule_meeting"
  | "draft_email"
  | "create_follow_up"
  | "generate_meeting_brief"
  | "stakeholder_review"
  | "commercial_intelligence"
  | "deep_research"
  | "ask"
  | "unknown";

export type SmartAssistCommandResult = {
  intent: SmartAssistCommandIntent;
  summary: string;
  actionLabel: string;
  href?: string;
  /** Resolved deal for CVM coach drill-down */
  dealId?: string;
  /** Open full CVM coach view in popup */
  openCoach?: boolean;
  /** Prefill for activity wizard or similar */
  prefill?: Record<string, string>;
  /** Structured executive briefing from Deep Research Mode */
  researchBriefing?: DeepResearchBriefing;
  /** Show full research briefing inline in SmartAssist */
  openResearch?: boolean;
};

export const SMART_ASSIST_SECTION_LABELS: Record<SmartAssistSectionId, string> = {
  today: "Today",
  upcoming: "Upcoming",
  follow_ups: "Follow-Ups",
  opportunities: "Opportunities",
  recommendations: "Recommendations",
};

export type SmartAssistMetric = {
  id: SmartAssistMetricId;
  emoji: string;
  label: string;
  count: number;
  viewAllHref: string;
};
