import type { ConfidenceLevel } from "@/lib/opportunity-workspace-intelligence";

/** Prepared SmartAssist email briefing — action-specific assistant payload. */
export type SmartAssistEmailBriefing = {
  actionLabel: string;
  reason: string;
  objective: string;
  expectedOutcome: string;
  confidence: ConfidenceLevel;
  confidenceLabel: string;
  to: string;
  contactName: string;
  companyName?: string;
  subject: string;
  body: string;
  suggestedFollowUp: string;
  suggestedMeeting: string;
  suggestedMeetingTitle: string;
};

export type SmartAssistEmailContext = {
  ownerName: string;
  contactName?: string;
};
