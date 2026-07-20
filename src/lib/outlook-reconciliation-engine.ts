import {
  activityMatchesContact,
  getActivitiesForCompany,
  getActivitiesForContact,
  getActivitiesForDeal,
} from "@/lib/activity-utils";
import { getContactDisplayName } from "@/types/contact";
import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { Contact } from "@/types/contact";
import type { PipelineRow } from "@/types/pipeline";
import type {
  ConnectedTouchpointSummary,
  MissingTouchpointCandidate,
  OutlookEvidenceRecord,
  OutlookReconciliationAudit,
} from "@/types/outlook-reconciliation";

/** Pure Outlook reconciliation analysis — safe for client and server bundles (no fs). */

export type ReconciliationContext = {
  companies: Company[];
  pipelines: PipelineRow[];
  activities: Activity[];
  outlookEvidence: OutlookEvidenceRecord[];
  connected?: boolean;
};

function parseDate(value: string): Date {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  return new Date(normalized);
}

function latestDate(dates: (string | null | undefined)[]): string | null {
  const valid = dates.filter(Boolean) as string[];
  if (valid.length === 0) return null;
  return valid.sort(
    (a, b) => parseDate(b).getTime() - parseDate(a).getTime(),
  )[0]!;
}

function outlookLastDates(evidence: OutlookEvidenceRecord): {
  lastEmail: string | null;
  lastMeeting: string | null;
} {
  return {
    lastEmail: latestDate(evidence.emails.map((email) => email.receivedDateTime)),
    lastMeeting: latestDate([
      ...evidence.teamsMeetings.map((meeting) => meeting.startDateTime),
      ...evidence.calendarEvents.map((event) => event.startDateTime),
    ]),
  };
}

function hasOutlookActivity(evidence: OutlookEvidenceRecord): boolean {
  return (
    evidence.emails.length > 0 ||
    evidence.teamsMeetings.length > 0 ||
    evidence.calendarEvents.length > 0
  );
}

function isEvidenceReconciled(evidence: OutlookEvidenceRecord): boolean {
  return Boolean(evidence.reconciledAt);
}

export function buildConnectedTouchpointSummary(
  crmActivities: Activity[],
  evidence: OutlookEvidenceRecord | null,
  connected: boolean,
): ConnectedTouchpointSummary {
  const sorted = [...crmActivities].sort(
    (a, b) => parseDate(b.ActivityDate).getTime() - parseDate(a.ActivityDate).getTime(),
  );
  const crmLastDate = sorted[0]?.ActivityDate ?? null;

  if (!connected || !evidence || isEvidenceReconciled(evidence)) {
    return {
      crmActivityCount: crmActivities.length,
      crmLastDate,
      outlookEmailCount: 0,
      outlookTeamsCount: 0,
      outlookCalendarCount: 0,
      outlookLastDate: null,
      effectiveLastDate: crmLastDate,
      connected,
      includesOutlook: false,
    };
  }

  const { lastEmail, lastMeeting } = outlookLastDates(evidence);
  const outlookLastDate = latestDate([lastEmail, lastMeeting]);

  return {
    crmActivityCount: crmActivities.length,
    crmLastDate,
    outlookEmailCount: evidence.emails.length,
    outlookTeamsCount: evidence.teamsMeetings.length,
    outlookCalendarCount: evidence.calendarEvents.length,
    outlookLastDate,
    effectiveLastDate: latestDate([crmLastDate, outlookLastDate]),
    connected,
    includesOutlook: hasOutlookActivity(evidence),
  };
}

function resolutionHref(
  entityType: MissingTouchpointCandidate["entityType"],
  entityId: string,
  companyId?: string,
): string {
  if (entityType === "contact") {
    const query = companyId ? `?company=${encodeURIComponent(companyId)}&reconcile=1` : "?reconcile=1";
    return `/contacts/${encodeURIComponent(entityId)}${query}`;
  }
  if (entityType === "company") {
    return `/companies/${encodeURIComponent(entityId)}?reconcile=1`;
  }
  return `/deals/${encodeURIComponent(entityId)}?reconcile=1`;
}

function buildCandidate(
  evidence: OutlookEvidenceRecord,
  entityType: MissingTouchpointCandidate["entityType"],
  entityId: string,
  entityLabel: string,
  crmActivities: Activity[],
  context: ReconciliationContext,
  companyId?: string,
  companyName?: string,
  contactEmail?: string,
): MissingTouchpointCandidate | null {
  if (!hasOutlookActivity(evidence) || isEvidenceReconciled(evidence)) {
    return null;
  }

  const connected = context.connected ?? context.outlookEvidence.length > 0;
  if (!connected) return null;

  const summary = buildConnectedTouchpointSummary(crmActivities, evidence, connected);

  if (summary.crmActivityCount > 0 && summary.effectiveLastDate === summary.crmLastDate) {
    const crmDays = summary.crmLastDate
      ? Math.floor(
          (Date.now() - parseDate(summary.crmLastDate).getTime()) / 86_400_000,
        )
      : 999;
    const outlookDays = summary.outlookLastDate
      ? Math.floor(
          (Date.now() - parseDate(summary.outlookLastDate).getTime()) / 86_400_000,
        )
      : 999;

    if (crmDays <= 30 && outlookDays >= crmDays - 7) {
      return null;
    }
  }

  const hasCrmGap = summary.crmActivityCount === 0;
  const outlookNewer =
    summary.outlookLastDate &&
    (!summary.crmLastDate ||
      parseDate(summary.outlookLastDate).getTime() >
        parseDate(summary.crmLastDate).getTime());

  if (!hasCrmGap && !outlookNewer) return null;

  const { lastEmail, lastMeeting } = outlookLastDates(evidence);
  const totalOutlook =
    evidence.emails.length +
    evidence.teamsMeetings.length +
    evidence.calendarEvents.length;

  return {
    id: `missing-${entityType}-${entityId}`,
    entityType,
    entityId,
    entityLabel,
    companyId,
    companyName,
    contactEmail,
    crmActivityCount: summary.crmActivityCount,
    crmLastActivityDate: summary.crmLastDate,
    outlookEmailCount: evidence.emails.length,
    outlookTeamsMeetingCount: evidence.teamsMeetings.length,
    outlookCalendarEventCount: evidence.calendarEvents.length,
    lastOutlookEmailDate: lastEmail,
    lastOutlookMeetingDate: lastMeeting,
    evidenceId: evidence.id,
    why: hasCrmGap
      ? `CRM shows no logged interactions, but ${totalOutlook} Outlook touchpoint${totalOutlook === 1 ? "" : "s"} exist.`
      : `Outlook activity is more recent than the last CRM interaction (${summary.crmLastDate?.slice(0, 10) ?? "none"}).`,
    impact:
      "Relationship health and attention signals under-report engagement — follow-ups and health scores may be wrong.",
    recommendedAction: "Import interaction history from connected Outlook.",
    resolutionHref: resolutionHref(entityType, entityId, companyId),
    resolutionLabel: "Import interaction history",
    severity: hasCrmGap ? "warning" : "info",
  };
}

export function analyzeOutlookReconciliation(
  context: ReconciliationContext,
): OutlookReconciliationAudit {
  const connected = context.connected ?? context.outlookEvidence.length > 0;
  const missingTouchpoints: MissingTouchpointCandidate[] = [];
  const seen = new Set<string>();

  for (const evidence of context.outlookEvidence) {
    if (evidence.entityType === "contact") {
      let contact: Contact | undefined;
      let company: Company | undefined;

      for (const row of context.companies) {
        contact = row.contacts.find((c) => c.ContactID === evidence.entityId);
        if (contact) {
          company = row;
          break;
        }
      }

      if (!contact || !company) continue;

      const crmActivities = getActivitiesForContact(
        context.activities,
        contact.ContactID,
        contact,
      );

      const candidate = buildCandidate(
        evidence,
        "contact",
        contact.ContactID,
        getContactDisplayName(contact),
        crmActivities,
        context,
        company.CompanyID,
        company.Title,
        contact.Email,
      );

      if (candidate && !seen.has(candidate.id)) {
        seen.add(candidate.id);
        missingTouchpoints.push(candidate);
      }
    }

    if (evidence.entityType === "company") {
      const company = context.companies.find((c) => c.CompanyID === evidence.entityId);
      if (!company) continue;

      const crmActivities = getActivitiesForCompany(context.activities, company);
      const candidate = buildCandidate(
        evidence,
        "company",
        company.CompanyID,
        company.Title,
        crmActivities,
        context,
        company.CompanyID,
        company.Title,
        evidence.contactEmail,
      );

      if (candidate && !seen.has(candidate.id)) {
        seen.add(candidate.id);
        missingTouchpoints.push(candidate);
      }
    }

    if (evidence.entityType === "opportunity" && evidence.dealId) {
      const deal = context.pipelines.find((p) => p.id === evidence.dealId);
      if (!deal) continue;

      const crmActivities = getActivitiesForDeal(context.activities, deal.id);
      const company = context.companies.find((c) => c.pipelineIds.includes(deal.id));

      const candidate = buildCandidate(
        evidence,
        "opportunity",
        deal.id,
        deal.assetName ?? deal.id,
        crmActivities,
        context,
        company?.CompanyID,
        company?.Title,
        evidence.contactEmail,
      );

      if (candidate && !seen.has(candidate.id)) {
        seen.add(candidate.id);
        missingTouchpoints.push(candidate);
      }
    }
  }

  missingTouchpoints.sort((a, b) => {
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  const totals = {
    contacts: missingTouchpoints.filter((row) => row.entityType === "contact").length,
    companies: missingTouchpoints.filter((row) => row.entityType === "company").length,
    opportunities: missingTouchpoints.filter((row) => row.entityType === "opportunity")
      .length,
  };

  const summary =
    !connected
      ? "Outlook is not connected — reconciliation requires M365 mailbox access."
      : missingTouchpoints.length === 0
        ? "All connected Outlook touchpoints are reflected in CRM."
        : `${missingTouchpoints.length} potential missing touchpoint${missingTouchpoints.length === 1 ? "" : "s"} detected across contacts, companies, and opportunities.`;

  return {
    generatedAt: new Date().toISOString(),
    connected,
    summary,
    missingTouchpoints,
    totals,
  };
}

export function findEvidenceForContact(
  evidence: OutlookEvidenceRecord[],
  contactId: string,
): OutlookEvidenceRecord | null {
  return (
    evidence.find(
      (row) => row.entityType === "contact" && row.entityId === contactId && !row.reconciledAt,
    ) ?? null
  );
}

export function findEvidenceForCompany(
  evidence: OutlookEvidenceRecord[],
  companyId: string,
): OutlookEvidenceRecord | null {
  return (
    evidence.find(
      (row) => row.entityType === "company" && row.entityId === companyId && !row.reconciledAt,
    ) ?? null
  );
}

export function toActionableTouchpoint(
  candidate: MissingTouchpointCandidate,
): {
  id: string;
  eyebrow: string;
  title: string;
  why: string;
  impact: string;
  recommendedAction: string;
  resolutionHref: string;
  resolutionLabel: string;
  severity: "critical" | "warning" | "healthy";
} {
  return {
    id: candidate.id,
    eyebrow: "Potential missing touchpoint",
    title: candidate.entityLabel,
    why: candidate.why,
    impact: candidate.impact,
    recommendedAction: candidate.recommendedAction,
    resolutionHref: candidate.resolutionHref,
    resolutionLabel: candidate.resolutionLabel,
    severity:
      candidate.severity === "critical"
        ? "critical"
        : candidate.severity === "warning"
          ? "warning"
          : "healthy",
  };
}

export function effectiveRecencyDetail(summary: ConnectedTouchpointSummary): string {
  if (!summary.connected || !summary.includesOutlook) {
    return summary.crmLastDate
      ? `Last CRM activity ${summary.crmLastDate.slice(0, 10)}`
      : "No recorded contact yet";
  }

  const parts: string[] = [];
  if (summary.crmActivityCount > 0) {
    parts.push(`${summary.crmActivityCount} CRM`);
  }
  if (summary.outlookEmailCount > 0) {
    parts.push(`${summary.outlookEmailCount} Outlook emails`);
  }
  if (summary.outlookTeamsCount > 0) {
    parts.push(`${summary.outlookTeamsCount} Teams meetings`);
  }
  if (summary.outlookCalendarCount > 0) {
    parts.push(`${summary.outlookCalendarCount} calendar events`);
  }

  const lastLabel = summary.effectiveLastDate?.slice(0, 10) ?? "unknown";
  return `Last touch ${lastLabel} — ${parts.join(", ")} (connected)`;
}
