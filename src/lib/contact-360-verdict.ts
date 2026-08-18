export type ContactCadence = "Warm" | "Cooling Off" | "Cold / At Risk";

export type ContactLastTouchSource = "outlook" | "activity";

export type Contact360Verdict = {
  lastInteractionAt: string | null;
  lastInteractionSource: ContactLastTouchSource | null;
  cadence: ContactCadence;
  summary: string;
  nextAction: string;
};

export function laterIso(a?: string | null, b?: string | null): string | null {
  const ta = a ? Date.parse(a) : Number.NaN;
  const tb = b ? Date.parse(b) : Number.NaN;
  if (!Number.isFinite(ta) && !Number.isFinite(tb)) return null;
  if (!Number.isFinite(ta)) return b?.trim() || null;
  if (!Number.isFinite(tb)) return a?.trim() || null;
  return ta >= tb ? a! : b!;
}

export function contactCadenceFromLastTouch(
  cadence: string | undefined,
  lastInteractionAt?: string | null,
): ContactCadence {
  if (cadence === "When needed") return "Warm";
  if (!lastInteractionAt) return "Cold / At Risk";
  const last = new Date(lastInteractionAt).getTime();
  if (!Number.isFinite(last)) return "Cold / At Risk";
  const days = Math.floor((Date.now() - last) / (1000 * 60 * 60 * 24));
  const cadenceDays =
    cadence === "Weekly"
      ? 7
      : cadence === "Bi-weekly"
        ? 14
        : cadence === "Quarterly"
          ? 90
          : cadence === "Yearly"
            ? 365
            : 30;
  if (days <= cadenceDays) return "Warm";
  if (days <= cadenceDays * 2) return "Cooling Off";
  return "Cold / At Risk";
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

export function buildContact360Verdict(input: {
  firstName: string;
  buyingRole?: string | null;
  engagementCadence?: string;
  lastActivityAt?: string | null;
  lastMailAt?: string | null;
  onOpportunity: boolean;
  onProject: boolean;
  mailProjectNotOnRoster?: string | null;
  mailOpportunityNotOnRoster?: string | null;
}): Contact360Verdict {
  const lastInteractionAt = laterIso(input.lastActivityAt, input.lastMailAt);
  const lastInteractionSource = sourceOfLatest(input.lastActivityAt, input.lastMailAt);
  const cadence = contactCadenceFromLastTouch(input.engagementCadence, lastInteractionAt);
  const name = input.firstName.trim() || "this person";
  const buyingUnknown = !input.buyingRole?.trim();

  if (!lastInteractionAt) {
    return {
      lastInteractionAt: null,
      lastInteractionSource: null,
      cadence,
      summary: `No interaction recorded with ${name} yet.`,
      nextAction: "Save a mail from Outlook, or log the first activity.",
    };
  }

  const via = lastInteractionSource === "outlook" ? " in Outlook" : "";
  const parts: string[] = [`Last touch was${via}.`];
  if (buyingUnknown) parts.push("Buying role is unknown.");

  let nextAction = "Reply if the thread is still open, or log the next commitment.";
  if (input.mailProjectNotOnRoster) {
    nextAction = `Add ${name} to ${input.mailProjectNotOnRoster} — mail is already tagged there.`;
  } else if (input.mailOpportunityNotOnRoster) {
    nextAction = `Add ${name} to ${input.mailOpportunityNotOnRoster} — mail is already tagged there.`;
  } else if (buyingUnknown) {
    nextAction = "Classify the buying role, then reply or plan the next touch.";
  } else if (!input.onOpportunity && !input.onProject) {
    nextAction = "Link this person to an opportunity or project if the work is commercial.";
  }

  return {
    lastInteractionAt,
    lastInteractionSource,
    cadence,
    summary: parts.join(" "),
    nextAction,
  };
}
