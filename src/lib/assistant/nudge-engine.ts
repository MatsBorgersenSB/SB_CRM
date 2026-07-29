/**
 * Proactive Nudge Engine — account health → actionable attention.
 * Reality First: only nudge from observed opportunities, contacts, activities, decisions.
 */

import { getActivitiesForCompany } from "@/lib/activity-utils";
import { findPrismaCompanyByRouteKey } from "@/lib/data/companies";
import { mailtoHref, m365ComposeHref } from "@/lib/compose-actions";
import { mapPrismaCompanyToApp } from "@/lib/prisma-mappers";
import { withPrismaRetry } from "@/lib/prisma";
import { readActivities } from "@/lib/pipeline-db";
import { daysBetween } from "@/lib/relative-time";
import { company360Href, companyRouteKey } from "@/types/company-360";
import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import { getContactDisplayName } from "@/types/contact";

export type NudgeSeverity = "high" | "medium" | "low";

export type NudgeActionKind =
  | "draft_email"
  | "add_economic_buyer"
  | "navigate"
  | "create_task";

export type NudgeAction = {
  id: string;
  label: string;
  kind: NudgeActionKind;
  href?: string;
};

export type Nudge = {
  id: string;
  companyId: string;
  companyName: string;
  opportunityId?: string;
  opportunityName?: string;
  severity: NudgeSeverity;
  title: string;
  message: string;
  impact: string[];
  actions: NudgeAction[];
  ruleId: "stalled_deal" | "missing_decision_maker" | "decision_follow_up";
};

const STALLED_DAYS = 14;
const DECISION_FOLLOW_UP_DAYS = 7;

const SEVERITY_RANK: Record<NudgeSeverity, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

type OpportunityTeamMember = {
  contactId?: string;
  projectRole?: string;
};

function parseActivityDate(value: string): Date {
  return new Date(value.includes("T") ? value : value.replace(" ", "T"));
}

function activityLinkedToOpportunity(
  activity: Activity,
  opportunityId: string,
): boolean {
  if (activity.Deal?.Title === opportunityId) return true;
  if (
    activity.Deal &&
    "DealID" in activity.Deal &&
    activity.Deal.DealID === opportunityId
  ) {
    return true;
  }
  return (activity.LinkedDeals ?? []).some((deal) => {
    if (!deal || typeof deal !== "object") return false;
    const row = deal as { Title?: string; DealID?: string; Id?: string | number };
    return (
      row.Title === opportunityId ||
      row.DealID === opportunityId ||
      String(row.Id ?? "") === opportunityId
    );
  });
}

function getOpportunityActivities(
  activities: Activity[],
  opportunityId: string,
): Activity[] {
  return activities
    .filter((activity) => activityLinkedToOpportunity(activity, opportunityId))
    .sort(
      (a, b) =>
        parseActivityDate(b.ActivityDate).getTime() -
        parseActivityDate(a.ActivityDate).getTime(),
    );
}

function isEconomicBuyerOrExecutiveTag(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  return /\beconomic\s*buyer\b|\bexecutive(\s+sponsor)?\b/i.test(value);
}

function contactIsDecisionMaker(contact: {
  buyingRole?: string | null;
  Role?: string | null;
}): boolean {
  return (
    isEconomicBuyerOrExecutiveTag(contact.buyingRole) ||
    isEconomicBuyerOrExecutiveTag(contact.Role)
  );
}

function teamHasDecisionMaker(team: unknown): boolean {
  if (!Array.isArray(team)) return false;
  return team.some((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const member = entry as OpportunityTeamMember;
    return isEconomicBuyerOrExecutiveTag(member.projectRole);
  });
}

function formatDecisionDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function primaryContactEmail(company: Company): string | undefined {
  const withEmail = company.contacts.find((contact) => contact.Email?.trim());
  return withEmail?.Email?.trim();
}

function primaryContactName(company: Company): string | undefined {
  const contact = company.contacts[0];
  return contact ? getContactDisplayName(contact) : undefined;
}

function draftOutreachActions(
  company: Company,
  opportunityName?: string,
): NudgeAction[] {
  const email = primaryContactEmail(company);
  const contactName = primaryContactName(company);
  const subject = opportunityName
    ? `Re-engage: ${opportunityName}`
    : `Follow-up — ${company.Title}`;
  const body = contactName
    ? `Hi ${contactName.split(" ")[0]},\n\nI wanted to reconnect on next steps.\n\nBest regards`
    : `Hi,\n\nI wanted to reconnect on next steps.\n\nBest regards`;

  if (!email) {
    return [
      {
        id: "open-contacts",
        label: "Open Contacts",
        kind: "navigate",
        href: company360Href(company, "contacts"),
      },
    ];
  }

  return [
    {
      id: "draft-outreach-m365",
      label: "Draft Outreach Email",
      kind: "draft_email",
      href: m365ComposeHref(email, subject, body),
    },
    {
      id: "draft-outreach-mailto",
      label: "Open in Mail",
      kind: "draft_email",
      href: mailtoHref(email, subject, body),
    },
  ];
}

function hasCompletedFollowUpAfterDecision(
  activities: Activity[],
  decisionCreatedAt: Date,
): boolean {
  return activities.some((activity) => {
    const activityDate = parseActivityDate(activity.ActivityDate);
    if (Number.isNaN(activityDate.getTime())) return false;
    if (activityDate.getTime() < decisionCreatedAt.getTime()) return false;
    if (activity.ActionStatus !== "Completed") return false;
    return activity.ActivityType === "Task" || activity.ActionRequired === true;
  });
}

/**
 * Inspect account health and return structured nudges for one company.
 */
export async function evaluateAccountNudges(
  companyId: string,
): Promise<Nudge[]> {
  const prismaCompany = await findPrismaCompanyByRouteKey(companyId);
  if (!prismaCompany) return [];

  const company = mapPrismaCompanyToApp(prismaCompany);
  const routeKey = companyRouteKey(company) || companyId;

  const [opportunities, decisions, allActivities] = await Promise.all([
    withPrismaRetry((prisma) =>
      prisma.opportunity.findMany({
        where: {
          companyId: prismaCompany.id,
          status: "open",
        },
        select: {
          id: true,
          name: true,
          team: true,
          status: true,
        },
      }),
    ),
    withPrismaRetry((prisma) =>
      prisma.decisionJournal.findMany({
        where: { companyId: prismaCompany.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ),
    readActivities(),
  ]);

  const companyActivities = getActivitiesForCompany(allActivities, company);
  const nudges: Nudge[] = [];

  // 1) Stalled Deal — open opportunity, no activity in >14 days
  for (const opportunity of opportunities) {
    const dealActivities = getOpportunityActivities(
      allActivities,
      opportunity.id,
    );
    const lastActivity = dealActivities[0];
    const daysSince = lastActivity
      ? daysBetween(lastActivity.ActivityDate)
      : Number.POSITIVE_INFINITY;

    if (daysSince > STALLED_DAYS) {
      const idleLabel = Number.isFinite(daysSince)
        ? `${daysSince} days`
        : "no recorded activity";
      nudges.push({
        id: `stalled_deal:${opportunity.id}`,
        companyId: routeKey,
        companyName: company.Title,
        opportunityId: opportunity.id,
        opportunityName: opportunity.name,
        severity: "high",
        title: "Opportunity stalled — Re-engage primary contact",
        message: `${opportunity.name} has had ${idleLabel} without logged activity.`,
        impact: [
          "Silent deals lose stakeholder attention and close probability drops.",
          "A short re-engagement now protects pipeline momentum.",
        ],
        actions: [
          ...draftOutreachActions(company, opportunity.name).slice(0, 1),
          {
            id: "open-opportunity",
            label: "Open Opportunity",
            kind: "navigate",
            href: `/deals/${encodeURIComponent(opportunity.id)}`,
          },
          {
            id: "log-activity",
            label: "Log Activity",
            kind: "navigate",
            href: company360Href(company, "activities"),
          },
        ],
        ruleId: "stalled_deal",
      });
    }
  }

  // 2) Missing Decision Maker — no Economic Buyer / Executive on account or open deals
  const contactHasBuyer = company.contacts.some((contact) =>
    contactIsDecisionMaker(contact),
  );
  const teamHasBuyer = opportunities.some((opportunity) =>
    teamHasDecisionMaker(opportunity.team),
  );

  if (
    !contactHasBuyer &&
    !teamHasBuyer &&
    (opportunities.length > 0 || company.contacts.length > 0)
  ) {
    nudges.push({
      id: `missing_decision_maker:${routeKey}`,
      companyId: routeKey,
      companyName: company.Title,
      severity: "medium",
      title: "No Economic Buyer identified in Buying Center",
      message:
        "No contact is tagged as Economic Buyer or Executive on this account.",
      impact: [
        "Without an economic buyer, deals stall in evaluation and never reach funding.",
        "Map the Buying Center before investing more discovery effort.",
      ],
      actions: [
        {
          id: "add-economic-buyer",
          label: "Add Economic Buyer",
          kind: "add_economic_buyer",
          href: company360Href(company, "contacts"),
        },
        {
          id: "open-contacts",
          label: "Review Contacts",
          kind: "navigate",
          href: company360Href(company, "contacts"),
        },
      ],
      ruleId: "missing_decision_maker",
    });
  }

  // 3) Recent Decision Follow-up — decision >7 days old, no completed follow-up task
  for (const decision of decisions) {
    const createdAt =
      decision.createdAt instanceof Date
        ? decision.createdAt
        : new Date(decision.createdAt);
    const ageDays = daysBetween(createdAt);
    if (ageDays <= DECISION_FOLLOW_UP_DAYS) continue;
    if (hasCompletedFollowUpAfterDecision(companyActivities, createdAt)) continue;

    const dateLabel = formatDecisionDate(createdAt);
    nudges.push({
      id: `decision_follow_up:${decision.id}`,
      companyId: routeKey,
      companyName: company.Title,
      opportunityId: decision.opportunityId ?? undefined,
      severity: "medium",
      title: `Follow up on decision made on ${dateLabel}`,
      message: decision.decisionText.slice(0, 180),
      impact: [
        "Unclosed decisions create false progress — the customer may assume we moved on.",
        "A completed follow-up converts the decision into commercial momentum.",
      ],
      actions: [
        ...draftOutreachActions(company).slice(0, 1),
        {
          id: "open-decisions",
          label: "Open Decision Journal",
          kind: "navigate",
          href: company360Href(company, "decisions"),
        },
        {
          id: "create-follow-up",
          label: "Create Follow-up Task",
          kind: "create_task",
          href: company360Href(company, "activities"),
        },
      ],
      ruleId: "decision_follow_up",
    });
  }

  return nudges.sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity],
  );
}

/**
 * Evaluate nudges across active companies (account overview).
 */
export async function evaluatePortfolioNudges(
  limit = 8,
): Promise<Nudge[]> {
  const companies = await withPrismaRetry((prisma) =>
    prisma.company.findMany({
      where: { status: "active" },
      select: { id: true, code: true },
      take: 40,
      orderBy: { updatedAt: "desc" },
    }),
  );

  const batches = await Promise.all(
    companies.map((company) =>
      evaluateAccountNudges(company.code?.trim() || company.id),
    ),
  );

  return batches
    .flat()
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
    .slice(0, limit);
}
