import { laterIso, type ContactLastTouchSource } from "@/lib/contact-360-verdict";
import { getContactDisplayName, type Contact } from "@/types/contact";

const ENGAGE_ROLE_ORDER = [
  "Champion",
  "Economic Buyer",
  "Technical Evaluator",
  "End User",
] as const;

export type Company360Verdict = {
  lastInteractionAt: string | null;
  lastInteractionSource: ContactLastTouchSource | null;
  nextAction: string;
  nextReason: string;
};

export function pickEngageContact(
  contacts: Contact[],
): { name: string; role: string } | null {
  const active = contacts.filter((contact) => !contact.IsArchived);
  if (active.length === 0) return null;

  const ranked = [...active].sort((a, b) => {
    const aIndex = ENGAGE_ROLE_ORDER.indexOf(
      a.buyingRole as (typeof ENGAGE_ROLE_ORDER)[number],
    );
    const bIndex = ENGAGE_ROLE_ORDER.indexOf(
      b.buyingRole as (typeof ENGAGE_ROLE_ORDER)[number],
    );
    const aRank = aIndex === -1 ? 99 : aIndex;
    const bRank = bIndex === -1 ? 99 : bIndex;
    if (aRank !== bRank) return aRank - bRank;
    return getContactDisplayName(a).localeCompare(getContactDisplayName(b));
  });

  const first = ranked[0];
  if (!first) return null;

  const buying = first.buyingRole?.trim();
  const role =
    buying && buying !== "No Buying Role"
      ? buying
      : first.JobTitle?.trim() || first.Role?.trim() || "contact";

  return { name: getContactDisplayName(first), role };
}

function sourceOfLatest(
  activityAt?: string | null,
  mailAt?: string | null,
): ContactLastTouchSource | null {
  const latest = laterIso(activityAt, mailAt);
  if (!latest) return null;
  const mailTime = mailAt ? Date.parse(mailAt) : Number.NaN;
  const activityTime = activityAt ? Date.parse(activityAt) : Number.NaN;
  if (Number.isFinite(mailTime) && latest === mailAt) return "outlook";
  if (Number.isFinite(activityTime) && latest === activityAt) return "activity";
  if (Number.isFinite(mailTime) && (!Number.isFinite(activityTime) || mailTime >= activityTime)) {
    return "outlook";
  }
  if (Number.isFinite(activityTime)) return "activity";
  return null;
}

/** Never show sentinel 999-day silence as if it were a real clock. */
export function humanizeEngineReason(reason: string): string {
  return reason
    .replace(/\b999\+?\s*days without deal activity\b/gi, "no deal activity recorded")
    .replace(/\b999\+?\s*days\b/gi, "no recorded activity")
    .replace(/\bno meaningful activity in 999\+?\s*days\b/gi, "no deal activity recorded");
}

export function buildCompany360Verdict(input: {
  engineAction: string;
  engineReason: string;
  lastActivityAt?: string | null;
  lastMailAt?: string | null;
  stalledDealName?: string | null;
  stalledDealStage?: string | null;
  engageContact?: { name: string; role: string } | null;
}): Company360Verdict {
  const lastInteractionAt = laterIso(input.lastActivityAt, input.lastMailAt);
  const lastInteractionSource = sourceOfLatest(input.lastActivityAt, input.lastMailAt);
  const via = lastInteractionSource === "outlook" ? " in Outlook" : "";
  const stage = input.stalledDealStage?.trim();
  const deal = input.stalledDealName?.trim();
  const person = input.engageContact;
  const lastMs = lastInteractionAt ? Date.parse(lastInteractionAt) : Number.NaN;
  const daysSinceTouch = Number.isFinite(lastMs)
    ? Math.floor((Date.now() - lastMs) / (1000 * 60 * 60 * 24))
    : null;
  const recentTouch = daysSinceTouch != null && daysSinceTouch < 14;

  if (deal && person && !recentTouch) {
    const dealLabel = stage ? `${deal} (${stage})` : deal;
    return {
      lastInteractionAt,
      lastInteractionSource,
      nextAction: `Write or call ${person.name}`,
      nextReason: `${person.role} — ${dealLabel} will not move without a human touch.`,
    };
  }

  if (lastInteractionAt && /\d+\s*days without deal activity/i.test(input.engineReason)) {
    return {
      lastInteractionAt,
      lastInteractionSource,
      nextAction: input.engineAction,
      nextReason: `Last touch was${via}. ${
        deal ? `${deal} still needs a next commercial step.` : humanizeEngineReason(input.engineReason)
      }`,
    };
  }

  return {
    lastInteractionAt,
    lastInteractionSource,
    nextAction: input.engineAction,
    nextReason: humanizeEngineReason(input.engineReason),
  };
}
