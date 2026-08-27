import type { CreateActivityInput } from "@/types/activity";
import type {
  OutlookEvidenceRecord,
  ReconciliationImportMode,
  ReconciliationImportResult,
} from "@/types/outlook-reconciliation";
import {
  analyzeOutlookReconciliation,
  type ReconciliationContext,
} from "@/lib/outlook-reconciliation-engine";

/** Server-only Outlook reconciliation mutations — uses fs-backed stores. */

export async function loadReconciliationContext(): Promise<ReconciliationContext> {
  const { readLiveFocusContext, readLiveOutlookEvidence } = await import(
    "@/lib/prisma-data"
  );

  const [focus, outlookEvidence] = await Promise.all([
    readLiveFocusContext(),
    readLiveOutlookEvidence(),
  ]);

  return {
    companies: focus.companies,
    pipelines: focus.pipelines,
    activities: focus.activities,
    outlookEvidence,
    connected: outlookEvidence.length > 0,
  };
}

export async function auditOutlookReconciliation(): Promise<
  ReturnType<typeof analyzeOutlookReconciliation>
> {
  const context = await loadReconciliationContext();
  return analyzeOutlookReconciliation(context);
}

function buildEmailSummaryActivity(
  evidence: OutlookEvidenceRecord,
  companyId?: string,
  contactId?: string,
): CreateActivityInput {
  const lastEmail = [...evidence.emails].sort(
    (a, b) =>
      new Date(b.receivedDateTime).getTime() - new Date(a.receivedDateTime).getTime(),
  )[0];

  const subjects = evidence.emails.slice(0, 3).map((email) => email.subject);
  const summarySubjects =
    subjects.length > 0 ? subjects.join("; ") : "Outlook email thread";

  return {
    ActivityType: "Email",
    ActivityDate: lastEmail?.receivedDateTime ?? new Date().toISOString(),
    Subject: `Outlook: ${evidence.emails.length} email${evidence.emails.length === 1 ? "" : "s"} reconciled`,
    ActivityDescription: `Imported from connected Outlook.\n\nRecent subjects:\n${summarySubjects}${evidence.emails.length > 3 ? `\n…and ${evidence.emails.length - 3} more` : ""}`,
    Summary: `${evidence.emails.length} Outlook emails imported into relationship history`,
    ActionRequired: false,
    NextAction: "",
    NextActionDate: "",
    ActionStatus: "Completed",
    ActionOutcome: "Neutral",
    M365Targets: { outlook: true },
    ReconciledFromOutlook: true,
    Company: companyId ? { CompanyID: companyId } : null,
    Contact: contactId ? { ContactID: contactId } : null,
    OutlookConversationId: lastEmail?.conversationId,
  };
}

function buildActivityFromEmail(
  email: OutlookEvidenceRecord["emails"][number],
  evidence: OutlookEvidenceRecord,
  companyId?: string,
  contactId?: string,
): CreateActivityInput {
  return {
    ActivityType: "Email",
    ActivityDate: email.receivedDateTime,
    Subject: email.subject,
    ActivityDescription:
      email.preview ??
      `Outlook ${email.direction} email reconciled into CRM relationship history.`,
    Summary: email.preview ?? email.subject,
    ActionRequired: false,
    NextAction: "",
    NextActionDate: "",
    ActionStatus: "Completed",
    ActionOutcome: "Neutral",
    M365Targets: { outlook: true },
    ReconciledFromOutlook: true,
    OutlookMessageId: email.id,
    OutlookConversationId: email.conversationId,
    Company: companyId ? { CompanyID: companyId } : null,
    Contact: contactId ? { ContactID: contactId } : null,
  };
}

function buildActivityFromMeeting(
  meeting: OutlookEvidenceRecord["teamsMeetings"][number] | OutlookEvidenceRecord["calendarEvents"][number],
  companyId?: string,
  contactId?: string,
): CreateActivityInput {
  const isTeams = "isTeamsMeeting" in meeting && meeting.isTeamsMeeting;
  return {
    ActivityType: isTeams ? "Teams Meeting" : "Meeting",
    ActivityDate: meeting.startDateTime,
    Subject: meeting.subject,
    ActivityDescription: `Reconciled from connected ${isTeams ? "Teams" : "Outlook calendar"}.`,
    Summary: meeting.subject,
    ActionRequired: false,
    NextAction: "",
    NextActionDate: "",
    ActionStatus: "Completed",
    ActionOutcome: "Neutral",
    M365Targets: isTeams ? { outlook: true, teams: true } : { outlook: true },
    ReconciledFromOutlook: true,
    Company: companyId ? { CompanyID: companyId } : null,
    Contact: contactId ? { ContactID: contactId } : null,
  };
}

function resolveEntityRefs(evidence: OutlookEvidenceRecord): {
  companyId?: string;
  contactId?: string;
} {
  if (evidence.entityType === "contact") {
    return { companyId: evidence.companyId, contactId: evidence.entityId };
  }
  if (evidence.entityType === "company") {
    return { companyId: evidence.entityId };
  }
  return { companyId: evidence.companyId, contactId: undefined };
}

export async function executeReconciliationImport(
  evidenceId: string,
  mode: ReconciliationImportMode,
): Promise<ReconciliationImportResult> {
  const { createActivity, readOutlookEvidence, updateOutlookEvidence } = await import(
    "@/lib/pipeline-db"
  );

  const evidenceRows = await readOutlookEvidence();
  const evidence = evidenceRows.find((row) => row.id === evidenceId);

  if (!evidence) {
    throw new Error(`Outlook evidence not found: ${evidenceId}`);
  }

  const { companyId, contactId } = resolveEntityRefs(evidence);
  const inputs: CreateActivityInput[] = [];

  if (mode === "email_summary") {
    inputs.push(buildEmailSummaryActivity(evidence, companyId, contactId));
  } else if (mode === "update_last_interaction") {
    const allDates = [
      ...evidence.emails.map((email) => ({
        type: "email" as const,
        date: email.receivedDateTime,
        email,
      })),
      ...evidence.teamsMeetings.map((meeting) => ({
        type: "teams" as const,
        date: meeting.startDateTime,
        meeting,
      })),
      ...evidence.calendarEvents.map((event) => ({
        type: "calendar" as const,
        date: event.startDateTime,
        meeting: event,
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const latest = allDates[0];
    if (!latest) {
      throw new Error("No Outlook touchpoints to import");
    }

    if (latest.type === "email") {
      inputs.push(buildActivityFromEmail(latest.email, evidence, companyId, contactId));
    } else {
      inputs.push(buildActivityFromMeeting(latest.meeting, companyId, contactId));
    }
  } else if (mode === "create_activities") {
    for (const email of evidence.emails) {
      inputs.push(buildActivityFromEmail(email, evidence, companyId, contactId));
    }
    for (const meeting of evidence.teamsMeetings) {
      inputs.push(buildActivityFromMeeting(meeting, companyId, contactId));
    }
    for (const event of evidence.calendarEvents) {
      inputs.push(buildActivityFromMeeting(event, companyId, contactId));
    }
  } else if (mode === "build_timeline") {
    const timeline = [
      ...evidence.emails.map((email) => ({
        date: email.receivedDateTime,
        build: () => buildActivityFromEmail(email, evidence, companyId, contactId),
      })),
      ...evidence.teamsMeetings.map((meeting) => ({
        date: meeting.startDateTime,
        build: () => buildActivityFromMeeting(meeting, companyId, contactId),
      })),
      ...evidence.calendarEvents.map((event) => ({
        date: event.startDateTime,
        build: () => buildActivityFromMeeting(event, companyId, contactId),
      })),
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    for (const entry of timeline) {
      inputs.push(entry.build());
    }
  }

  const activityIds: string[] = [];
  for (const input of inputs) {
    const created = await createActivity(input);
    activityIds.push(created.ActivityID);
  }

  await updateOutlookEvidence(evidenceId, {
    reconciledAt: new Date().toISOString(),
  });

  return {
    mode,
    activitiesCreated: activityIds.length,
    activityIds,
    evidenceId,
    completedAt: new Date().toISOString(),
  };
}
