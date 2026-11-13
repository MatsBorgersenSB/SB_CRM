import { buildCompany360Snapshot } from "@/lib/company-360-data";
import { computeOpportunityIntelligence } from "@/lib/opportunity-intelligence-engine";
import { formatDealValue } from "@/types/pipeline";
import { formatRelativeTime } from "@/lib/relative-time";
import { buildM365Meta, ensureImpact } from "@/lib/m365/meta";
import { toM365Action, toM365RiskFromCompanySignal } from "@/lib/m365/blocks";
import type { M365DataContext } from "@/lib/m365/resolve-context";
import type { Company } from "@/types/company";
import type {
  M365AccountCommitmentItem,
  M365AccountLinkedItem,
  M365AccountPerson,
  M365AccountWorkspacePayload,
} from "@/types/m365";
import { M365_BUDGETS, capItems } from "@/types/m365";
import { company360Href } from "@/types/company-360";
import { contact360Href, deal360Href, project360Href } from "@/types/relationship-navigation";
import {
  formatCompanyTypesLabel,
  formatRelationshipPostureLabel,
  getCompanyRelationshipPosture,
  isOpportunityEligibleCompany,
  normalizeCompanyTypes,
} from "@/lib/company-classification";
import { isFollowUpOpen, isFollowUpOverdue } from "@/lib/activity-utils";
import { getProjectsForCompany } from "@/lib/project-team-utils";
import { getContactDisplayName } from "@/types/contact";
import { sanitizeBriefingCopy } from "@/lib/m365/meeting-briefing";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function buildM365AccountWorkspace(
  company: Company,
  ctx: M365DataContext,
): M365AccountWorkspacePayload {
  const snapshot = buildCompany360Snapshot(
    company,
    ctx.pipelines,
    ctx.activities,
    ctx.inventory,
  );

  const { header, intelligence, pipelines, openActions, activities } = snapshot;
  const posture = getCompanyRelationshipPosture(company);
  const companyTypes = normalizeCompanyTypes(company);
  const relationshipRoleLabel =
    companyTypes[0] === "Unclassified"
      ? formatRelationshipPostureLabel(posture)
      : formatCompanyTypesLabel(companyTypes, { max: 2 });

  const topRiskSignal = intelligence.riskSignals[0];
  const topRisk = topRiskSignal ? toM365RiskFromCompanySignal(topRiskSignal) : null;
  const nextBestAction = toM365Action(intelligence.recommendedAction, company.CompanyID);

  const whatChanged = capItems(
    buildWhatChanged(activities, topRisk?.label ?? null),
    M365_BUDGETS.accountWorkspace.maxWhatChanged,
  );

  const openCommitments = capItems(
    buildOpenCommitments(openActions),
    M365_BUDGETS.accountWorkspace.maxCommitments,
  );

  const linkedItems = capItems(
    buildLinkedItems(company, pipelines, ctx),
    M365_BUDGETS.accountWorkspace.maxLinkedItems,
  );

  const peopleWhoMatter = capItems(
    buildPeopleWhoMatter(company),
    M365_BUDGETS.accountWorkspace.maxPeople,
  );

  return {
    kind: "account-workspace",
    meta: buildM365Meta({
      whatMatters: `${header.companyName} — ${relationshipRoleLabel}`,
      whatIsAtRisk: topRisk?.label ?? "No critical account risks",
      whyItMatters: topRisk?.impact ?? [header.lastContactLabel || "Keep the relationship moving"],
      whatShouldHappenNext: nextBestAction.action,
    }),
    companyName: header.companyName,
    companyId: company.CompanyID,
    relationshipRoleLabel,
    health: {
      score: header.healthScore,
      status: header.healthStatus,
      trend: header.trend,
    },
    lastContactLabel: header.lastContactLabel,
    whatChanged,
    topRisk,
    nextBestAction,
    openCommitments,
    linkedItems,
    peopleWhoMatter,
    deepLink: company360Href(company.CompanyID),
  };
}

function buildWhatChanged(
  activities: ReturnType<typeof buildCompany360Snapshot>["activities"],
  topRiskLabel: string | null,
): string[] {
  const lines: string[] = [];
  const cutoff = Date.now() - SEVEN_DAYS_MS;
  const recent = activities.filter((activity) => {
    const stamp = Date.parse(activity.ActivityDate);
    return Number.isFinite(stamp) && stamp >= cutoff;
  });

  if (recent[0]) {
    lines.push(
      `Last 7 days: ${recent[0].Subject} (${formatRelativeTime(recent[0].ActivityDate)})`,
    );
    if (recent.length > 1) {
      lines.push(
        `${recent.length} interactions in the last week — momentum is visible.`,
      );
    }
  } else if (activities[0]) {
    lines.push(
      `Quiet recently — last touch ${activities[0].Subject} (${formatRelativeTime(activities[0].ActivityDate)})`,
    );
  } else {
    lines.push("No recorded contact yet — start the relationship timeline.");
  }

  if (topRiskLabel) {
    const riskLine = sanitizeBriefingCopy(topRiskLabel);
    if (!lines.some((line) => line.toLowerCase().includes(riskLine.toLowerCase()))) {
      lines.push(`Watch: ${riskLine}`);
    }
  }

  return lines;
}

function buildOpenCommitments(
  openActions: ReturnType<typeof buildCompany360Snapshot>["openActions"],
): M365AccountCommitmentItem[] {
  const open = openActions.filter(isFollowUpOpen);
  return [...open]
    .sort((a, b) => {
      const aOverdue = isFollowUpOverdue(a) ? 0 : 1;
      const bOverdue = isFollowUpOverdue(b) ? 0 : 1;
      if (aOverdue !== bOverdue) return aOverdue - bOverdue;
      return (a.NextActionDate || "9999").localeCompare(b.NextActionDate || "9999");
    })
    .map((activity) => {
      const overdue = isFollowUpOverdue(activity);
      const title =
        (activity.NextAction || activity.Subject).trim() || "Open commitment";
      return {
        id: activity.ActivityID,
        title,
        dueLabel: activity.NextActionDate
          ? overdue
            ? `Overdue · ${formatRelativeTime(activity.NextActionDate)}`
            : `Due ${formatRelativeTime(activity.NextActionDate)}`
          : "No due date",
        overdue,
        impact: ensureImpact(
          [
            overdue
              ? "Overdue commitments erode trust and delay progress"
              : "Open commitments must be resolved to keep momentum",
          ],
          title,
        ),
        href: `/activities/${activity.ActivityID}`,
      };
    });
}

function buildLinkedItems(
  company: Company,
  pipelines: ReturnType<typeof buildCompany360Snapshot>["pipelines"],
  ctx: M365DataContext,
): M365AccountLinkedItem[] {
  const sellTo = isOpportunityEligibleCompany(company);
  const items: M365AccountLinkedItem[] = [];

  if (sellTo) {
    for (const pipeline of pipelines) {
      const intel = computeOpportunityIntelligence(
        pipeline,
        [company],
        ctx.activities,
        ctx.pipelines,
      );
      items.push({
        id: intel.dealId,
        kind: "opportunity",
        label: intel.dealName,
        detail: `${intel.stage} · ${formatDealValue(intel.currency, intel.salesValue)}`,
        impact: ensureImpact([intel.healthSummary, intel.nextBestAction.reason], intel.dealName),
        href: deal360Href(intel.dealId),
      });
    }
  }

  const contactIds = (company.contacts ?? []).map((contact) => contact.ContactID);
  const projects = getProjectsForCompany(company.CompanyID, ctx.projects ?? [], {
    contactIds,
  });

  for (const project of projects) {
    items.push({
      id: project.id,
      kind: "project",
      label: project.name,
      detail: project.status?.trim() || "Project",
      impact: ensureImpact([`Delivery work linked to ${company.Title}`], project.name),
      href: project360Href(project.id),
    });
  }

  // Buy-from / collaborate / watch / unclassified → projects only (no invented pipeline).
  if (!sellTo) {
    return items.filter((item) => item.kind === "project");
  }

  return items;
}

function buildPeopleWhoMatter(company: Company): M365AccountPerson[] {
  const contacts = [...(company.contacts ?? [])];
  const rank = (role: string) => {
    const value = role.toLowerCase();
    if (value.includes("decision")) return 0;
    if (value.includes("sponsor") || value.includes("champion")) return 1;
    if (value.includes("influencer") || value.includes("buyer")) return 2;
    return 3;
  };

  return contacts
    .map((contact) => {
      const name = getContactDisplayName(contact).trim();
      if (!name) return null;
      const roleLabel =
        contact.Role?.trim() ||
        contact.JobTitle?.trim() ||
        contact.buyingRole?.trim() ||
        "Contact";
      return {
        id: contact.ContactID,
        name,
        roleLabel,
        href: contact360Href(contact.ContactID, company.CompanyID),
        _rank: rank(roleLabel),
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort((a, b) => a._rank - b._rank || a.name.localeCompare(b.name))
    .map(({ id, name, roleLabel, href }) => ({ id, name, roleLabel, href }));
}
