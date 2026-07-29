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

export type NudgeSeverity = "HIGH" | "MEDIUM" | "LOW";

export type NudgeActionType =
  | "DRAFT_OUTREACH_EMAIL"
  | "ADD_ECONOMIC_BUYER"
  | "OPEN_OPPORTUNITY"
  | "CREATE_FOLLOW_UP_TASK"
  | "OPEN_DECISION_JOURNAL"
  | "NAVIGATE";

export type NudgeActionPayload = {
  /** Primary 1-click destination (compose link, section anchor, deal route). */
  href?: string;
  /** Button label for the primary action. */
  label?: string;
  companyId?: string;
  companyName?: string;
  opportunityId?: string;
  opportunityName?: string;
  decisionId?: string;
  email?: string;
  subject?: string;
  body?: string;
  /** Optional secondary actions (Open Opportunity, Log Activity, etc.). */
  secondaryActions?: Array<{
    label: string;
    href: string;
    actionType: NudgeActionType;
  }>;
};

export type Nudge = {
  id: string;
  severity: NudgeSeverity;
  title: string;
  description: string;
  actionType: NudgeActionType;
  actionPayload: NudgeActionPayload;
};

const STALLED_DAYS = 14;
const DECISION_FOLLOW_UP_DAYS = 7;

const SEVERITY_RANK: Record<NudgeSeverity, number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
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

function buildOutreachPayload(
  company: Company,
  routeKey: string,
  opportunityName?: string,
): Pick<
  NudgeActionPayload,
  "href" | "label" | "email" | "subject" | "body" | "secondaryActions"
> {
  const email = primaryContactEmail(company);
  const contactName = primaryContactName(company);
  const subject = opportunityName
    ? `Re-engage: ${opportunityName}`
    : `Follow-up — ${company.Title}`;
  const body = contactName
    ? `Hi ${contactName.split(" ")[0]},\n\nI wanted to reconnect on next steps.\n\nBest regards`
    : `Hi,\n\nI wanted to reconnect on next steps.\n\nBest regards`;

  if (!email) {
    return {
      href: company360Href(company, "contacts"),
      label: "Open Contacts",
      secondaryActions: [
        {
          label: "Review Account",
          href: company360Href(routeKey),
          actionType: "NAVIGATE",
        },
      ],
    };
  }

  return {
    href: m365ComposeHref(email, subject, body),
    label: "Draft Outreach Email",
    email,
    subject,
    body,
    secondaryActions: [
      {
        label: "Open in Mail",
        href: mailtoHref(email, subject, body),
        actionType: "DRAFT_OUTREACH_EMAIL",
      },
    ],
  };
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
      const outreach = buildOutreachPayload(company, routeKey, opportunity.name);
      nudges.push({
        id: `stalled_deal:${opportunity.id}`,
        severity: "HIGH",
        title: "Opportunity stalled — Re-engage primary contact",
        description: `${opportunity.name} has had ${idleLabel} without logged activity.`,
        actionType: "DRAFT_OUTREACH_EMAIL",
        actionPayload: {
          ...outreach,
          companyId: routeKey,
          companyName: company.Title,
          opportunityId: opportunity.id,
          opportunityName: opportunity.name,
          secondaryActions: [
            ...(outreach.secondaryActions ?? []),
            {
              label: "Open Opportunity",
              href: `/deals/${encodeURIComponent(opportunity.id)}`,
              actionType: "OPEN_OPPORTUNITY",
            },
            {
              label: "Log Activity",
              href: company360Href(company, "activities"),
              actionType: "NAVIGATE",
            },
          ],
        },
      });
    }
  }

  // 2) Missing Decision Maker — no Economic Buyer / Executive tagged
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
      severity: "MEDIUM",
      title: "No Economic Buyer identified in Buying Center",
      description:
        "No contact is tagged as Economic Buyer or Executive on this account.",
      actionType: "ADD_ECONOMIC_BUYER",
      actionPayload: {
        href: company360Href(company, "contacts"),
        label: "Add Economic Buyer",
        companyId: routeKey,
        companyName: company.Title,
        secondaryActions: [
          {
            label: "Review Contacts",
            href: company360Href(company, "contacts"),
            actionType: "NAVIGATE",
          },
        ],
      },
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
    const outreach = buildOutreachPayload(company, routeKey);
    nudges.push({
      id: `decision_follow_up:${decision.id}`,
      severity: "MEDIUM",
      title: `Follow up on decision made on ${dateLabel}`,
      description: decision.decisionText.slice(0, 180),
      actionType: "DRAFT_OUTREACH_EMAIL",
      actionPayload: {
        ...outreach,
        companyId: routeKey,
        companyName: company.Title,
        opportunityId: decision.opportunityId ?? undefined,
        decisionId: decision.id,
        secondaryActions: [
          ...(outreach.secondaryActions ?? []),
          {
            label: "Open Decision Journal",
            href: company360Href(company, "decisions"),
            actionType: "OPEN_DECISION_JOURNAL",
          },
          {
            label: "Create Follow-up Task",
            href: company360Href(company, "activities"),
            actionType: "CREATE_FOLLOW_UP_TASK",
          },
        ],
      },
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
