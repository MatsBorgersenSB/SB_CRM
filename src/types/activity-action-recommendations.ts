import type { ConfidenceLevel } from "@/lib/opportunity-workspace-intelligence";
import type { SmartAssistMeeting } from "@/types/smartassist-meeting";

export type ActivityRecommendedActionType =
  | "send_email"
  | "schedule_call"
  | "schedule_teams_meeting"
  | "create_follow_up"
  | "request_information"
  | "escalate"
  | "close_activity";

export const ACTIVITY_ACTION_LABELS: Record<ActivityRecommendedActionType, string> = {
  send_email: "Send Email",
  schedule_call: "Schedule Call",
  schedule_teams_meeting: "Schedule Teams Meeting",
  create_follow_up: "Create Follow-Up Activity",
  request_information: "Request Information",
  escalate: "Escalate",
  close_activity: "Close Activity",
};

export type ActivityActionRecommendation = {
  actionType: ActivityRecommendedActionType;
  actionLabel: string;
  reason: string;
  expectedOutcome: string;
  confidence: ConfidenceLevel;
  confidenceReason: string;
};

export type PreparedEmailAction = {
  to: string;
  subject: string;
  body: string;
  objective: string;
};

export type PreparedCallAction = {
  objective: string;
  suggestedQuestions: string[];
  desiredOutcome: string;
  contactPhone: string | null;
};

export type PreparedTeamsMeetingAction = SmartAssistMeeting;

export type PreparedFollowUpAction = {
  title: string;
  dueDate: string;
  dueDateLabel: string;
  purpose: string;
  successCriteria: string;
};

export type PreparedEscalationAction = {
  to: string;
  subject: string;
  body: string;
  objective: string;
};

export type ActivityActionRecommendations = {
  blockingProgress: string;
  blockerCategoryLabel: string;
  primary: ActivityActionRecommendation;
  alternatives: ActivityActionRecommendation[];
  email?: PreparedEmailAction;
  call?: PreparedCallAction;
  teamsMeeting?: PreparedTeamsMeetingAction;
  followUp?: PreparedFollowUpAction;
  escalation?: PreparedEscalationAction;
};
