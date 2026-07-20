/** Phase 1.26 — Outlook Relationship Reconciliation */

export type OutlookEvidenceSource = "outlook_email" | "teams_meeting" | "calendar_event";

export type OutlookEmailEvidence = {
  id: string;
  subject: string;
  receivedDateTime: string;
  direction: "sent" | "received";
  preview?: string;
  conversationId?: string;
};

export type OutlookMeetingEvidence = {
  id: string;
  subject: string;
  startDateTime: string;
  endDateTime?: string;
  organizer?: string;
  isTeamsMeeting?: boolean;
};

export type OutlookEvidenceEntityType = "contact" | "company" | "opportunity";

export type OutlookEvidenceRecord = {
  id: string;
  entityType: OutlookEvidenceEntityType;
  entityId: string;
  contactEmail?: string;
  companyId?: string;
  dealId?: string;
  emails: OutlookEmailEvidence[];
  teamsMeetings: OutlookMeetingEvidence[];
  calendarEvents: OutlookMeetingEvidence[];
  connectedAt: string;
  /** Set when evidence has been fully reconciled into CRM activities */
  reconciledAt?: string | null;
};

export type ReconciliationImportMode =
  | "email_summary"
  | "create_activities"
  | "update_last_interaction"
  | "build_timeline";

export type MissingTouchpointCandidate = {
  id: string;
  entityType: OutlookEvidenceEntityType;
  entityId: string;
  entityLabel: string;
  companyId?: string;
  companyName?: string;
  contactEmail?: string;
  crmActivityCount: number;
  crmLastActivityDate: string | null;
  outlookEmailCount: number;
  outlookTeamsMeetingCount: number;
  outlookCalendarEventCount: number;
  lastOutlookEmailDate: string | null;
  lastOutlookMeetingDate: string | null;
  evidenceId: string;
  why: string;
  impact: string;
  recommendedAction: string;
  resolutionHref: string;
  resolutionLabel: string;
  severity: "critical" | "warning" | "info";
};

export type OutlookReconciliationAudit = {
  generatedAt: string;
  connected: boolean;
  summary: string;
  missingTouchpoints: MissingTouchpointCandidate[];
  totals: {
    contacts: number;
    companies: number;
    opportunities: number;
  };
};

export type ReconciliationImportResult = {
  mode: ReconciliationImportMode;
  activitiesCreated: number;
  activityIds: string[];
  evidenceId: string;
  completedAt: string;
};

export type ConnectedTouchpointSummary = {
  crmActivityCount: number;
  crmLastDate: string | null;
  outlookEmailCount: number;
  outlookTeamsCount: number;
  outlookCalendarCount: number;
  outlookLastDate: string | null;
  effectiveLastDate: string | null;
  connected: boolean;
  includesOutlook: boolean;
};
