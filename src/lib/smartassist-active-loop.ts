/**
 * FS-013 Active Operating Loop — additional prepared proposals.
 * Observe → prepare activity / reminder / record update. User decides.
 */

import { getActivitiesForCompany, isFollowUpOpen, resolveActivityCompany } from "@/lib/activity-utils";
import {
  formatAccountOwnerDisplay,
  hasCompanyOwner,
} from "@/lib/company-owner";
import { isCompanyUnclassified } from "@/lib/company-classification";
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
 */
export function proposalsFromLivingRecords(
  companies: Company[],
  activities: Activity[],
): CoPilotActionProposal[] {
  const proposals: CoPilotActionProposal[] = [];

  for (const company of companies) {
    const companyActivities = getActivitiesForCompany(activities, company);

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

    if (isCompanyUnclassified(company)) {
      const id = `copilot-classify-${company.CompanyID}`;
      const kind = "classify_company" as const;
      proposals.push({
        id,
        kind,
        status: "pending",
        title: `Classify relationship — ${company.Title}`,
        reason:
          "Relationship type is Unclassified — SmartAssist will not invent Customer or opportunities.",
        impact: "Wrong posture creates junk pipeline; classify once, decide correctly forever.",
        observedChange: `Account "${company.Title}" is Unclassified`,
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
          prefill: { companyId: company.CompanyID, focus: "company-type" },
        },
      });
    }

    if (company.contacts.length > 0 && companyActivities.length === 0) {
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
  }

  return proposals;
}
