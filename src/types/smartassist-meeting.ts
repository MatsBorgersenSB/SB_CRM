export type MeetingPurpose =
  | "discovery"
  | "validation"
  | "follow_up"
  | "executive_review"
  | "opportunity_review"
  | "technical_review";

export const MEETING_PURPOSE_LABELS: Record<MeetingPurpose, string> = {
  discovery: "Discovery Meeting",
  validation: "Validation Meeting",
  follow_up: "Follow-Up Meeting",
  executive_review: "Executive Review",
  opportunity_review: "Opportunity Review",
  technical_review: "Technical Review",
};

/** Structured meeting brief — scannable in under 3 seconds. */
export type SmartAssistMeeting = {
  title: string;
  purpose: MeetingPurpose;
  purposeLabel: string;
  objective: string;
  /** Five agenda items: three discussion topics, then Decisions Required, then Next Steps. */
  agenda: [string, string, string, "Decisions Required", "Next Steps"];
  decisionsRequired: string[];
  desiredOutcomes: string[];
  suggestedDuration: string;
  suggestedAttendees: string[];
};
