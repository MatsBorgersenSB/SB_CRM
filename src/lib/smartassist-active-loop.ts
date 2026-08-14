/**
 * FS-013 Active Operating Loop — additional prepared proposals.
 * Observe → prepare activity / reminder / record update. User decides.
 */

import { getActivitiesForCompany, isFollowUpOpen, resolveActivityCompany } from "@/lib/activity-utils";
import {
  formatAccountOwnerDisplay,
  hasCompanyOwner,
} from "@/lib/company-owner";
import {
  getCompanyRelationshipPosture,
  isCompanyUnclassified,
} from "@/lib/company-classification";
import {
  hasCorrespondence,
  isMisclassifiedCommercialTarget,
  type CompanyCorrespondenceEvidence,
} from "@/lib/company-correspondence";
import {
  companyHasSectors,
  detectSectorsFromText,
  formatSectorsLabel,
} from "@/lib/company-sectors";
import { buildCoPilotSuppressionKey } from "@/lib/smartassist-copilot-keys";
import { company360Href } from "@/types/company-360";
import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { CoPilotActionProposal } from "@/types/smartassist-copilot";

function daysUntil(isoDate: string): number | null {
  if (!isoDate.trim()) return null;
  const raw = isoDate.includes("T") ? isoDate : `${isoDate}T12:00:00`;
  const target = new Date(raw);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

function isoDatePlusDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Prepare follow-up reminders for open commitments due within 7 days.
 */
export function proposalsFromUpcomingCommitments(
  activities: Activity[],
  companies: Company[],
): CoPilotActionProposal[] {
  const proposals: CoPilotActionProposal[] = [];

  for (const activity of activities) {
    if (!isFollowUpOpen(activity)) continue;
    const dueIn = daysUntil(activity.NextActionDate);
    if (dueIn === null || dueIn < 0 || dueIn > 7) continue;

    const company = resolveActivityCompany(activity, companies);
    if (!company) continue;

    const id = `copilot-reminder-${activity.ActivityID}`;
    const kind = "set_reminder" as const;
    const commitment = activity.NextAction?.trim() || activity.Subject;
    const nextActionDate =
      typeof activity.NextActionDate === "string"
        ? activity.NextActionDate.slice(0, 10)
        : isoDatePlusDays(dueIn);

    proposals.push({
      id,
      kind,
      status: "pending",
      title: `Set reminder — ${commitment}`,
      reason:
        dueIn === 0
          ? "Commitment is due today — prepare a dated follow-up so it does not slip."
          : `Commitment is due in ${dueIn} day${dueIn === 1 ? "" : "s"} — prepare a reminder activity.`,
      impact: "Keeps promises visible — missed commitments erode trust.",
      observedChange: `Open commitment "${commitment}" on ${company.Title}`,
      sourceType: "activity",
      severity: dueIn <= 1 ? "needs_attention" : "waiting",
      companyId: company.CompanyID,
      companyName: company.Title,
      objectName: activity.Subject,
      href: `/activities/${activity.ActivityID}`,
      suppressionKey: buildCoPilotSuppressionKey({
        id,
        kind,
        companyId: company.CompanyID,
      }),
      payload: {
        createActivity: {
          ActivityType: "Task",
          Subject: `Reminder: ${commitment}`,
          Summary: `Follow through on commitment from "${activity.Subject}".`,
          ActivityDate: new Date().toISOString(),
          ActionRequired: true,
          NextAction: commitment,
          NextActionDate: nextActionDate,
          ActionStatus: "Planned",
          Company: { CompanyID: company.CompanyID },
          Contact: activity.Contact,
          Deal: activity.Deal,
        },
      },
    });
  }

  return proposals;
}

/**
 * Living record proposals — missing owner / unclassified relationship /
 * first interaction when contacts exist with zero activities.
 * Correspondence (mail / project tags) counts as interaction — Reality First.
 */
export function proposalsFromLivingRecords(
  companies: Company[],
  activities: Activity[],
  correspondenceByCompanyId?: Map<string, CompanyCorrespondenceEvidence>,
): CoPilotActionProposal[] {
  const proposals: CoPilotActionProposal[] = [];

  for (const company of companies) {
    const companyActivities = getActivitiesForCompany(activities, company);
    const correspondence =
      correspondenceByCompanyId?.get(company.CompanyID) ?? null;

    if (!hasCompanyOwner(company) || !formatAccountOwnerDisplay(company.AccountOwner)) {
      const id = `copilot-owner-${company.CompanyID}`;
      const kind = "propose_record_update" as const;
      proposals.push({
        id,
        kind,
        status: "pending",
        title: `Assign account owner — ${company.Title}`,
        reason:
          "No accountable owner is recorded — SmartAssist cannot route reminders or portfolio focus.",
        impact: "Without an owner, commitments and follow-ups fall through the cracks.",
        observedChange: `Account "${company.Title}" has no valid account owner`,
        sourceType: "relationship",
        severity: "needs_attention",
        companyId: company.CompanyID,
        companyName: company.Title,
        objectName: company.Title,
        href: company360Href(company.CompanyID),
        suppressionKey: buildCoPilotSuppressionKey({
          id,
          kind,
          companyId: company.CompanyID,
          ruleId: "assign_account_owner",
        }),
        payload: {
          recordUpdate: {
            companyId: company.CompanyID,
            fieldLabel: "Account Owner",
          },
          prefill: { companyId: company.CompanyID, focus: "account-owner" },
        },
      });
    }

    if (
      isCompanyUnclassified(company) ||
      isMisclassifiedCommercialTarget(company, correspondence)
    ) {
      const id = `copilot-classify-${company.CompanyID}`;
      const kind = "classify_company" as const;
      const projectLabel =
        correspondence?.projectNames[0] != null
          ? ` (e.g. ${correspondence.projectNames[0]})`
          : "";
      const misclassifiedDelivery = isMisclassifiedCommercialTarget(
        company,
        correspondence,
      );
      proposals.push({
        id,
        kind,
        status: "pending",
        title: misclassifiedDelivery
          ? `Classify as supplier / service provider — ${company.Title}`
          : `Classify relationship — ${company.Title}`,
        reason: misclassifiedDelivery
          ? `Project-tagged correspondence${projectLabel} shows delivery work — do not invent a sales opportunity; set the correct relationship role.`
          : "Relationship type is Unclassified — SmartAssist will not invent Customer or opportunities.",
        impact:
          "Wrong posture creates junk pipeline; classify once, decide correctly forever.",
        observedChange: misclassifiedDelivery
          ? `"${company.Title}" has project-linked mail but is not typed Customer/Offtaker`
          : `Account "${company.Title}" is Unclassified`,
        sourceType: "relationship",
        severity: "needs_attention",
        companyId: company.CompanyID,
        companyName: company.Title,
        objectName: company.Title,
        href: company360Href(company.CompanyID),
        suppressionKey: buildCoPilotSuppressionKey({
          id,
          kind,
          companyId: company.CompanyID,
          ruleId: "classify_relationship",
        }),
        payload: {
          prefill: {
            companyId: company.CompanyID,
            focus: "company-type",
            ...(misclassifiedDelivery
              ? { suggestedType: "Service Provider" }
              : {}),
          },
        },
      });
    }

    if (!companyHasSectors(company) && correspondence?.mailKeywordHaystack) {
      const detected = detectSectorsFromText(correspondence.mailKeywordHaystack);
      const top = detected[0];
      if (top) {
        const id = `copilot-sector-${company.CompanyID}`;
        const kind = "propose_record_update" as const;
        const others = detected.slice(1).map((entry) => entry.sector);
        const extra =
          others.length > 0
            ? ` Also mentioned: ${formatSectorsLabel(others)}.`
            : "";
        proposals.push({
          id,
          kind,
          status: "pending",
          title: `Propose sector tag — ${top.sector}`,
          reason: `Email threads mention ${top.sector.toLowerCase()} language.${extra} Assign the tag so drafts and ROI stay sector-specific.`,
          impact:
            "Untagged companies get generic messaging — sector tags keep follow-ups and economics relevant.",
          observedChange: `No sector on "${company.Title}" — mail matches ${top.sector}`,
          sourceType: "email",
          severity: "needs_attention",
          companyId: company.CompanyID,
          companyName: company.Title,
          objectName: company.Title,
          href: company360Href(company.CompanyID),
          suppressionKey: buildCoPilotSuppressionKey({
            id,
            kind,
            companyId: company.CompanyID,
            ruleId: "propose_sector_tag",
          }),
          payload: {
            recordUpdate: {
              companyId: company.CompanyID,
              fieldLabel: "Sector",
              companyPatch: { Sectors: [top.sector] },
            },
            prefill: {
              companyId: company.CompanyID,
              focus: "sector",
              suggestedSector: top.sector,
            },
          },
        });
      }
    }

    // Knowledge before questions — Outlook / project mail means this is not first contact.
    if (
      company.contacts.length > 0 &&
      companyActivities.length === 0 &&
      !hasCorrespondence(correspondence)
    ) {
      const contact = company.contacts[0]!;
      const id = `copilot-first-touch-${company.CompanyID}`;
      const kind = "create_activity" as const;
      proposals.push({
        id,
        kind,
        status: "pending",
        title: `Plan first interaction — ${company.Title}`,
        reason:
          "Contacts exist but no activity is logged — prepare a discovery touchpoint so the relationship has memory.",
        impact: "Without a first logged interaction, SmartAssist cannot learn what matters.",
        observedChange: `${company.contacts.length} contact(s) on "${company.Title}" with zero activities`,
        sourceType: "relationship",
        severity: "needs_attention",
        companyId: company.CompanyID,
        companyName: company.Title,
        objectName: company.Title,
        href: company360Href(company.CompanyID),
        suppressionKey: buildCoPilotSuppressionKey({
          id,
          kind,
          companyId: company.CompanyID,
          ruleId: "no_activity",
        }),
        payload: {
          createActivity: {
            ActivityType: "Phone Call",
            Subject: `Discovery call — ${company.Title}`,
            Summary: `First logged interaction with ${contact.FirstName} ${contact.LastName}`.trim(),
            ActivityDate: new Date().toISOString(),
            ActionRequired: true,
            NextAction: "Complete discovery call and capture next step",
            NextActionDate: isoDatePlusDays(3),
            ActionStatus: "Planned",
            Company: { CompanyID: company.CompanyID },
            Contact: { ContactID: contact.ContactID },
          },
        },
      });
    }

    // Correspondence exists but CRM has no activity — capture for commercial
    // relationships only. Buy-from / collaborate mail is already knowledge;
    // do not nag IT suppliers to invent CRM busywork.
    const posture = getCompanyRelationshipPosture(company);
    const skipCaptureForPosture =
      posture === "buy_from" ||
      posture === "collaborate" ||
      posture === "watch" ||
      posture === "fund" ||
      posture === "internal";

    if (
      company.contacts.length > 0 &&
      companyActivities.length === 0 &&
      hasCorrespondence(correspondence) &&
      !skipCaptureForPosture
    ) {
      const contact = company.contacts[0]!;
      const projectHint =
        correspondence?.projectNames[0] != null
          ? ` (${correspondence.projectNames[0]})`
          : "";
      const id = `copilot-capture-mail-${company.CompanyID}`;
      const kind = "create_activity" as const;
      proposals.push({
        id,
        kind,
        status: "pending",
        title: `Capture correspondence — ${company.Title}`,
        reason: `${correspondence!.messageCount} email(s) already exist${projectHint} — log a CRM activity so SmartAssist stops treating this as a cold start.`,
        impact:
          "Without capturing known mail, recommendations invent first-contact and miss delivery context.",
        observedChange: `Mail evidence for "${company.Title}" with zero CRM activities`,
        sourceType: "email",
        severity: "needs_attention",
        companyId: company.CompanyID,
        companyName: company.Title,
        objectName: company.Title,
        href: company360Href(company.CompanyID),
        suppressionKey: buildCoPilotSuppressionKey({
          id,
          kind,
          companyId: company.CompanyID,
          ruleId: "capture_correspondence",
        }),
        payload: {
          createActivity: {
            ActivityType: "Email",
            Subject: `Correspondence${projectHint} — ${company.Title}`,
            Summary: `Capture ongoing correspondence with ${contact.FirstName} ${contact.LastName}`.trim(),
            ActivityDate: correspondence!.lastSentAt ?? new Date().toISOString(),
            ActionRequired: false,
            ActionStatus: "Completed",
            Company: { CompanyID: company.CompanyID },
            Contact: { ContactID: contact.ContactID },
          },
        },
      });
    }
  }

  return proposals;
}

/**
 * Turn captured AgreedActions / NextAction from meetings into reminder proposals.
 * Reality First — only uses text already on the activity.
 */
export function proposalsFromMeetingCommitments(
  activities: Activity[],
  companies: Company[],
): CoPilotActionProposal[] {
  const proposals: CoPilotActionProposal[] = [];

  for (const activity of activities) {
    const isMeeting =
      activity.ActivityType === "Meeting" || activity.ActivityType === "Teams Meeting";
    if (!isMeeting) continue;

    const company = resolveActivityCompany(activity, companies);
    if (!company) continue;

    const commitments: { text: string; due?: string }[] = [];

    for (const agreed of activity.AgreedActions ?? []) {
      if (!agreed.text?.trim()) continue;
      if (agreed.status === "Completed" || agreed.status === "Cancelled") continue;
      commitments.push({ text: agreed.text.trim(), due: agreed.dueDate });
    }

    const nextAction = activity.NextAction?.trim() ?? "";
    if (
      nextAction &&
      isFollowUpOpen(activity) &&
      commitments.every((item) => item.text.toLowerCase() !== nextAction.toLowerCase())
    ) {
      commitments.push({
        text: nextAction,
        due: activity.NextActionDate,
      });
    }

    for (const [index, commitment] of commitments.slice(0, 2).entries()) {
      const id = `copilot-meeting-commit-${activity.ActivityID}-${index}`;
      const kind = "set_reminder" as const;
      const due = commitment.due?.trim().slice(0, 10) || isoDatePlusDays(3);

      proposals.push({
        id,
        kind,
        status: "pending",
        title: `Set reminder — ${commitment.text.slice(0, 72)}`,
        reason:
          "Meeting commitment captured — prepare a dated follow-up so the promise stays visible.",
        impact: "Missed meeting commitments erode trust and stall commercial progress.",
        observedChange: `Commitment from meeting "${activity.Subject}"`,
        sourceType: "meeting",
        severity: "needs_attention",
        companyId: company.CompanyID,
        companyName: company.Title,
        objectName: activity.Subject,
        href: `/activities/${activity.ActivityID}`,
        suppressionKey: buildCoPilotSuppressionKey({
          id,
          kind,
          companyId: company.CompanyID,
        }),
        payload: {
          createActivity: {
            ActivityType: "Task",
            Subject: `Reminder: ${commitment.text.slice(0, 100)}`,
            Summary: `From meeting "${activity.Subject}": ${commitment.text}`,
            ActivityDate: new Date().toISOString(),
            ActionRequired: true,
            NextAction: commitment.text,
            NextActionDate: due,
            ActionStatus: "Planned",
            Company: { CompanyID: company.CompanyID },
            Contact: activity.Contact,
            Deal: activity.Deal,
          },
        },
      });
    }
  }

  return proposals;
}

/**
 * Note action asks from inbound mail; remind when proposal/RFP wait needs follow-up.
 */
export function proposalsFromCorrespondenceActions(
  companies: Company[],
  activities: Activity[],
  correspondenceByCompanyId?: Map<string, CompanyCorrespondenceEvidence>,
): CoPilotActionProposal[] {
  if (!correspondenceByCompanyId?.size) return [];

  const proposals: CoPilotActionProposal[] = [];

  for (const company of companies) {
    const evidence = correspondenceByCompanyId.get(company.CompanyID);
    if (!evidence) continue;

    const companyActivities = getActivitiesForCompany(activities, company);
    const contact = company.contacts[0];

    for (const ask of evidence.actionAsks.slice(0, 2)) {
      const subjectKey = ask.subject.replace(/^re:\s*/i, "").trim().toLowerCase().slice(0, 40);
      const alreadyNoted = companyActivities.some((activity) => {
        const hay =
          `${activity.Subject} ${activity.NextAction ?? ""} ${activity.Summary ?? ""}`.toLowerCase();
        return (
          (subjectKey.length > 8 && hay.includes(subjectKey)) ||
          (ask.excerpt.length > 20 && hay.includes(ask.excerpt.slice(0, 40).toLowerCase()))
        );
      });
      if (alreadyNoted) continue;

      const id = `copilot-mail-ask-${ask.messageId}`;
      const kind = "create_activity" as const;
      const nextAction = ask.excerpt.slice(0, 120) || ask.subject;
      proposals.push({
        id,
        kind,
        status: "pending",
        title: `Note requested action — ${ask.subject.replace(/^Re:\s*/i, "").slice(0, 64)}`,
        reason: `Inbound correspondence asks for action: "${ask.excerpt}"`,
        impact:
          "Untracked asks become broken promises — note the commitment so follow-through is visible.",
        observedChange: `Action ask in mail "${ask.subject}" (${ask.sentAt.slice(0, 10)})`,
        sourceType: "email",
        severity: "needs_attention",
        companyId: company.CompanyID,
        companyName: company.Title,
        objectName: ask.subject,
        href: company360Href(company.CompanyID),
        suppressionKey: buildCoPilotSuppressionKey({
          id,
          kind,
          companyId: company.CompanyID,
          ruleId: "mail_action_ask",
        }),
        payload: {
          createActivity: {
            ActivityType: "Email",
            Subject: `Action requested: ${ask.subject.replace(/^Re:\s*/i, "").slice(0, 100)}`,
            Summary: ask.excerpt,
            ActivityDate: ask.sentAt,
            ActionRequired: true,
            NextAction: nextAction,
            NextActionDate: isoDatePlusDays(3),
            ActionStatus: "Planned",
            Company: { CompanyID: company.CompanyID },
            Contact: contact ? { ContactID: contact.ContactID } : undefined,
          },
        },
      });
    }

    for (const followUp of evidence.proposalFollowUps.slice(0, 2)) {
      const subjectKey = followUp.subject
        .replace(/^re:\s*/i, "")
        .trim()
        .toLowerCase()
        .slice(0, 40);
      const alreadyTracked = companyActivities.some((activity) => {
        if (!isFollowUpOpen(activity)) return false;
        const hay = `${activity.Subject} ${activity.NextAction ?? ""}`.toLowerCase();
        return (
          hay.includes("proposal") ||
          hay.includes("quotation") ||
          hay.includes("tilbud") ||
          hay.includes("quote") ||
          (subjectKey.length > 8 && hay.includes(subjectKey))
        );
      });
      if (alreadyTracked) continue;

      const id = `copilot-mail-proposal-${followUp.messageId}`;
      const kind = "set_reminder" as const;
      const isRequest = followUp.kind === "proposal_requested";
      proposals.push({
        id,
        kind,
        status: "pending",
        title: isRequest
          ? `Follow up proposal request — ${company.Title}`
          : `Follow up proposal — ${company.Title}`,
        reason: isRequest
          ? `Proposal/quote was requested ${followUp.daysSince} days ago with no reply — follow-up is required.`
          : `Proposal/quotation was sent ${followUp.daysSince} days ago with no reply — follow-up is required.`,
        impact:
          "Silent proposal threads stall deals and supplier delivery; a dated reminder protects momentum.",
        observedChange: `"${followUp.subject}" sent ${followUp.sentAt.slice(0, 10)} — no inbound reply`,
        sourceType: "email",
        severity: followUp.daysSince >= 7 ? "urgent" : "needs_attention",
        companyId: company.CompanyID,
        companyName: company.Title,
        objectName: followUp.subject,
        href: company360Href(company.CompanyID),
        suppressionKey: buildCoPilotSuppressionKey({
          id,
          kind,
          companyId: company.CompanyID,
          ruleId: "mail_proposal_followup",
        }),
        payload: {
          createActivity: {
            ActivityType: "Task",
            Subject: isRequest
              ? `Follow up proposal request — ${followUp.subject.replace(/^Re:\s*/i, "").slice(0, 80)}`
              : `Follow up proposal — ${followUp.subject.replace(/^Re:\s*/i, "").slice(0, 80)}`,
            Summary: isRequest
              ? `Outbound request for proposal/quote has waited ${followUp.daysSince} days without a reply.`
              : `Outbound proposal/quotation has waited ${followUp.daysSince} days without a reply.`,
            ActivityDate: new Date().toISOString(),
            ActionRequired: true,
            NextAction: isRequest
              ? "Chase proposal/quote response"
              : "Chase proposal follow-up",
            NextActionDate: isoDatePlusDays(1),
            ActionStatus: "Planned",
            Company: { CompanyID: company.CompanyID },
            Contact: contact ? { ContactID: contact.ContactID } : undefined,
          },
        },
      });
    }

    for (const promise of evidence.openPromises.slice(0, 2)) {
      const id = `copilot-mail-promise-${promise.messageId}`;
      const kind = "create_activity" as const;
      proposals.push({
        id,
        kind,
        status: "pending",
        title: `Deliver promised follow-through — ${company.Title}`,
        reason: `We promised in mail: "${promise.excerpt}" — note and complete the commitment.`,
        impact:
          "Broken outbound promises erode trust faster than missed inbound asks.",
        observedChange: `Open promise in "${promise.subject}" (${promise.sentAt.slice(0, 10)})`,
        sourceType: "email",
        severity: "needs_attention",
        companyId: company.CompanyID,
        companyName: company.Title,
        objectName: promise.subject,
        href: company360Href(company.CompanyID),
        suppressionKey: buildCoPilotSuppressionKey({
          id,
          kind,
          companyId: company.CompanyID,
          ruleId: "mail_open_promise",
        }),
        payload: {
          createActivity: {
            ActivityType: "Task",
            Subject: `Promise: ${promise.excerpt.slice(0, 100)}`,
            Summary: promise.excerpt,
            ActivityDate: promise.sentAt,
            ActionRequired: true,
            NextAction: promise.excerpt.slice(0, 120),
            NextActionDate: isoDatePlusDays(2),
            ActionStatus: "Planned",
            Company: { CompanyID: company.CompanyID },
            Contact: contact ? { ContactID: contact.ContactID } : undefined,
          },
        },
      });
    }
  }

  return proposals;
}
