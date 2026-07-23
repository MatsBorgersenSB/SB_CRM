export {
  generateEmailDraft,
  type EmailDraftResult,
  type EmailDraftTone,
  type GenerateEmailDraftInput,
} from "@/lib/ai/email-copilot";

export {
  extractMeetingInsights,
  type MeetingActionItem,
  type MeetingInsights,
} from "@/lib/ai/meeting-intelligence";

export {
  calculateDealRiskScore,
  type DealRiskLevel,
  type DealVelocityInput,
  type DealVelocityNextAction,
  type DealVelocityResult,
} from "@/lib/ai/deal-velocity";
