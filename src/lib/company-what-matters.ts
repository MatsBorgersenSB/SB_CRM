import {
  getActivitiesForDeal,
  isFollowUpOpen,
  isFollowUpOverdue,
} from "@/lib/activity-utils";
import {
  getCompanyRelationshipPosture,
  type CompanyRelationshipPosture,
} from "@/lib/company-classification";
import { daysBetween } from "@/lib/relative-time";
import type { Activity } from "@/types/activity";
import type { AttentionSeverity } from "@/types/attention-item";
import type { Company } from "@/types/company";
import { getContactDisplayName } from "@/types/contact";
import type { PipelineRow } from "@/types/pipeline";

/**
 * One sentence per company — "What matters".
 *
 * Replaces the canned attention label on the Companies list. Rules:
 * - One sentence, first match wins, written for the person deciding.
 * - Posture-aware: suppliers get supplier facts or nothing; competitors and
 *   investors get nothing; only sell-to companies are nudged towards contact.
 * - Reality First: no sentence is better than a default. `null` renders as "—".
 */
export type CompanyWhatMatters = {
  sentence: string;
  severity: AttentionSeverity;
  ruleId: CompanyWhatMattersRuleId;
};

export type CompanyWhatMattersRuleId =
  | "overdue_followup"
  | "due_today"
  | "stalled_opportunity"
  | "classify_relationship"
  | "no_recent_contact"
  | "no_activity"
  | "add_primary_contact"
  | "deal_active"
  | "no_opportunity";

export type CompanyWhatMattersInput = {
  company: Company;
  /** Activities already scoped to this company. */
  companyActivities: Activity[];
  /** All activities — needed to look up deal-level touches. */
  activities: Activity[];
  /** Open opportunities for this company (closed / live excluded). */
  openDeals: PipelineRow[];
  /** Latest of CRM activity and synced mail; null when nothing recorded. */
  lastContactAt: string | null;
  now?: Date;
};

const COLD_DAYS = 45;
const URGENT_COLD_DAYS = 60;
const STALLED_DAYS = 21;
const URGENT_STALLED_DAYS = 45;

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function commitmentLabel(activity: Activity): string {
  return activity.NextAction || activity.Subject || "open commitment";
}

function days(n: number): string {
  return `${n} day${n === 1 ? "" : "s"}`;
}

/** "today" / "1 day ago" / "N days ago" — never "0 days ago". */
function ago(n: number): string {
  return n <= 0 ? "today" : `${days(n)} ago`;
}

function parseActivityDate(value: string): Date {
  return new Date(value.includes("T") ? value : value.replace(" ", "T"));
}

function latestDealTouchDays(
  deal: PipelineRow,
  activities: Activity[],
  now: Date,
): number | null {
  const dealActivities = getActivitiesForDeal(activities, deal.id);
  if (dealActivities.length === 0) return null;
  const latest = dealActivities.reduce((best, activity) => {
    const time = parseActivityDate(activity.ActivityDate).getTime();
    return time > best ? time : best;
  }, 0);
  return daysBetween(new Date(latest), now);
}

function postureCaresAboutCadence(posture: CompanyRelationshipPosture): boolean {
  return posture === "sell_to" || posture === "collaborate";
}

export function composeCompanyWhatMatters(
  input: CompanyWhatMattersInput,
): CompanyWhatMatters | null {
  const now = input.now ?? new Date();
  const { company, companyActivities, activities, openDeals, lastContactAt } = input;
  const posture = getCompanyRelationshipPosture(company);

  // 1. A promise we are breaking — always first, regardless of posture.
  const overdue = companyActivities
    .filter((activity) => isFollowUpOpen(activity) && isFollowUpOverdue(activity))
    .sort((a, b) => (a.NextActionDate ?? "").localeCompare(b.NextActionDate ?? ""));
  if (overdue[0]) {
    const daysOverdue = overdue[0].NextActionDate
      ? Math.max(1, daysBetween(overdue[0].NextActionDate, now))
      : 1;
    const more = overdue.length > 1 ? ` and ${overdue.length - 1} more` : "";
    return {
      sentence: `"${commitmentLabel(overdue[0])}" is ${days(daysOverdue)} overdue${more}.`,
      severity: "urgent",
      ruleId: "overdue_followup",
    };
  }

  const daysSince = lastContactAt ? daysBetween(lastContactAt, now) : null;

  // 2. An opportunity that has gone quiet. Mail is not linked to deals, so a deal with no
  //    logged activity borrows the company's last touch rather than being called dead.
  const stalled = openDeals
    .map((deal) => ({
      deal,
      touchDays: latestDealTouchDays(deal, activities, now) ?? daysSince,
    }))
    .filter(({ touchDays }) => touchDays === null || touchDays >= STALLED_DAYS)
    .sort((a, b) => (b.touchDays ?? Infinity) - (a.touchDays ?? Infinity));
  if (stalled[0]) {
    const { deal, touchDays } = stalled[0];
    const quiet =
      touchDays === null
        ? "has no recorded activity"
        : `has had no activity for ${days(touchDays)}`;
    return {
      sentence: `${deal.assetName} (${deal.status}) ${quiet}.`,
      severity:
        touchDays === null || touchDays >= URGENT_STALLED_DAYS ? "urgent" : "needs_attention",
      ruleId: "stalled_opportunity",
    };
  }

  // 3. Something due today.
  const today = startOfDay(now);
  const dueToday = companyActivities.find(
    (activity) =>
      isFollowUpOpen(activity) &&
      activity.NextActionDate &&
      startOfDay(new Date(activity.NextActionDate)) === today,
  );
  if (dueToday) {
    return {
      sentence: `"${commitmentLabel(dueToday)}" is due today.`,
      severity: "waiting",
      ruleId: "due_today",
    };
  }

  // 4. We don't know what kind of relationship this is — decide that first.
  if (posture === "unclassified") {
    return {
      sentence: "Relationship type not set — classify before acting.",
      severity: "needs_attention",
      ruleId: "classify_relationship",
    };
  }

  // Suppliers, competitors, investors, internal: nothing above means nothing to say.
  if (!postureCaresAboutCadence(posture)) return null;

  // 5. Relationship cooling.
  if (daysSince !== null && daysSince >= COLD_DAYS) {
    const withDeal =
      openDeals.length > 0
        ? openDeals.length === 1
          ? ` with ${openDeals[0]!.assetName} open`
          : ` with ${openDeals.length} opportunities open`
        : "";
    return {
      sentence: `Last touch ${ago(daysSince)}${withDeal}.`,
      severity:
        daysSince >= URGENT_COLD_DAYS && openDeals.length > 0 ? "urgent" : "needs_attention",
      ruleId: "no_recent_contact",
    };
  }

  // 6. Never spoken — only a gap for companies we intend to sell to.
  if (daysSince === null) {
    if (posture !== "sell_to") return null;
    const contact = company.contacts[0];
    if (!contact) {
      return {
        sentence: "No one to contact yet — add a stakeholder first.",
        severity: "needs_attention",
        ruleId: "add_primary_contact",
      };
    }
    const title = contact.JobTitle?.trim();
    return {
      sentence: `No conversation yet — start with ${getContactDisplayName(contact)}${title ? ` (${title})` : ""}.`,
      severity: "needs_attention",
      ruleId: "no_activity",
    };
  }

  // 7. Deals moving — say which, so the row still answers "what matters".
  //    (daysSince is non-null here: the null case returned above.)
  if (openDeals.length === 1) {
    const deal = openDeals[0]!;
    return {
      sentence: `${deal.assetName} at ${deal.status}, last touch ${ago(daysSince)}.`,
      severity: "healthy",
      ruleId: "deal_active",
    };
  }
  if (openDeals.length > 1) {
    return {
      sentence: `${openDeals.length} opportunities open, last touch ${ago(daysSince)}.`,
      severity: "healthy",
      ruleId: "deal_active",
    };
  }

  // 8. In contact, nothing commercial — a decision point for sell-to only.
  if (posture === "sell_to") {
    return {
      sentence: `In contact ${ago(daysSince)}, no opportunity yet.`,
      severity: "waiting",
      ruleId: "no_opportunity",
    };
  }

  return null;
}
