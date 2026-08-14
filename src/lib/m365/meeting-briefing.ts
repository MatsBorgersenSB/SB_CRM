import { buildCompany360Snapshot } from "@/lib/company-360-data";
import { computeOpportunityIntelligence } from "@/lib/opportunity-intelligence-engine";
import { buildCompanyCopilotSummary } from "@/lib/smartcrm-copilot-engine";
import { formatDealValue } from "@/types/pipeline";
import { formatRelativeTime } from "@/lib/relative-time";
import { buildM365Meta, ensureImpact } from "@/lib/m365/meta";
import {
  toM365Action,
  toM365RiskFromCompanySignal,
  toM365RiskFromDealSignal,
} from "@/lib/m365/blocks";
import type { M365DataContext } from "@/lib/m365/resolve-context";
import type { Company } from "@/types/company";
import type { Contact } from "@/types/contact";
import { getContactDisplayName } from "@/types/contact";
import type { M365MeetingBriefingPayload, M365OpportunityBlock, M365RiskBlock } from "@/types/m365";
import { M365_BUDGETS, capItems } from "@/types/m365";
import { company360Href } from "@/types/company-360";
import { deal360Href } from "@/types/relationship-navigation";

export type MeetingBriefingOptions = {
  contact?: Contact;
  counterpartyEmail?: string | null;
};

/**
 * Meeting Briefing — decision-ready, Michelin: one objective, one NBA, no score dumps.
 */
export function buildM365MeetingBriefing(
  company: Company,
  ctx: M365DataContext,
  options: MeetingBriefingOptions = {},
): M365MeetingBriefingPayload {
  const snapshot = buildCompany360Snapshot(
    company,
    ctx.pipelines,
    ctx.activities,
    ctx.inventory,
  );

  const copilot = buildCompanyCopilotSummary(snapshot, ctx.activities);
  const { intelligence, pipelines } = snapshot;
  const contact = options.contact;
  const counterpartyName = contact ? getContactDisplayName(contact) : null;
  const counterpartyRole = contact?.JobTitle?.trim() || contact?.Role?.trim() || null;
  const counterpartyEmail =
    options.counterpartyEmail?.trim() || contact?.Email?.trim() || null;

  const opportunities: M365OpportunityBlock[] = capItems(
    pipelines.map((pipeline) => {
      const intel = computeOpportunityIntelligence(
        pipeline,
        [company],
        ctx.activities,
        ctx.pipelines,
      );
      const valueLabel = formatDealValue(intel.currency, intel.salesValue);
      const topDealRisk = intel.risks[0];
      const impactLine = sanitizeBriefingCopy(
        topDealRisk?.detail || intel.healthSummary || `${valueLabel} in ${intel.stage}`,
      );

      return {
        id: intel.dealId,
        label: intel.dealName,
        stage: intel.stage,
        valueLabel,
        healthScore: intel.healthScore,
        impact: ensureImpact([impactLine], `${valueLabel} at stake`),
        href: deal360Href(intel.dealId),
      };
    }),
    M365_BUDGETS.meetingBriefing.maxOpportunities,
  );

  const companyRisks = intelligence.riskSignals.map((signal) =>
    sanitizeRisk(toM365RiskFromCompanySignal(signal)),
  );

  const dealRisks = pipelines.flatMap((pipeline) => {
    const intel = computeOpportunityIntelligence(
      pipeline,
      [company],
      ctx.activities,
      ctx.pipelines,
    );
    return intel.risks.map((risk) =>
      sanitizeRisk(
        toM365RiskFromDealSignal(
          risk,
          `${formatDealValue(intel.currency, intel.salesValue)} deal exposure`,
        ),
      ),
    );
  });

  const topRisks = capItems(
    dedupeRisks([...companyRisks, ...dealRisks]).sort((a, b) => {
      const rank = { critical: 0, warning: 1, info: 2 };
      return rank[a.severity] - rank[b.severity];
    }),
    M365_BUDGETS.meetingBriefing.maxRisks,
  );

  const whatChanged = capItems(
    buildWhatChanged(snapshot, topRisks),
    M365_BUDGETS.meetingBriefing.maxWhatChanged,
  );

  const discussionTopics = capItems(
    buildDiscussionTopics(counterpartyName, opportunities, topRisks),
    M365_BUDGETS.meetingBriefing.maxDiscussionTopics,
  );

  const nextBestAction = sanitizeAction(
    toM365Action(intelligence.recommendedAction, company.CompanyID),
  );
  if (opportunities[0]?.href) {
    nextBestAction.href = opportunities[0].href;
  }

  const meetingObjective = buildMeetingObjective(
    company.Title,
    counterpartyName,
    opportunities,
    topRisks,
    nextBestAction.action,
  );

  const relationshipSummary = humanRelationshipSummary(
    copilot.relationshipSummary,
    company.Title,
    counterpartyName,
  );

  const primaryRisk = topRisks[0]?.label ?? "No urgent risks";

  return {
    kind: "meeting-briefing",
    meta: buildM365Meta({
      whatMatters: meetingObjective,
      whatIsAtRisk: primaryRisk,
      whyItMatters: topRisks[0]?.impact ?? [relationshipSummary],
      whatShouldHappenNext: nextBestAction.action,
    }),
    companyName: company.Title,
    counterpartyName,
    counterpartyRole,
    counterpartyEmail,
    meetingObjective,
    relationshipSummary,
    whatChanged,
    openOpportunities: opportunities,
    topRisks,
    discussionTopics,
    nextBestAction,
    deepLink: company360Href(company.CompanyID),
  };
}

/** Never show sentinel 999 / multi-year day counts in human briefing copy. */
export function sanitizeBriefingCopy(text: string): string {
  return text
    .replace(/\b999\s*days?\b/gi, "no recorded activity")
    .replace(/\bno activity in 999\+?\s*days?\b/gi, "no deal activity recorded")
    .replace(/\b\d{3,}\s*days without deal activity\b/gi, "no deal activity recorded")
    .replace(/\b\d{3,}\s*days without (?:deal )?activity\b/gi, "no activity recorded")
    .replace(/\b\d{3,}\s*days without contact\b/gi, "no recent contact recorded")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function sanitizeRisk(risk: M365RiskBlock): M365RiskBlock {
  return {
    ...risk,
    detail: risk.detail ? sanitizeBriefingCopy(risk.detail) : risk.detail,
    impact: risk.impact.map(sanitizeBriefingCopy).filter(Boolean),
  };
}

function sanitizeAction(
  action: M365MeetingBriefingPayload["nextBestAction"],
): M365MeetingBriefingPayload["nextBestAction"] {
  return {
    ...action,
    action: sanitizeBriefingCopy(action.action),
    impact: action.impact.map(sanitizeBriefingCopy).filter(Boolean),
  };
}

function dedupeRisks(risks: M365RiskBlock[]): M365RiskBlock[] {
  const seen = new Set<string>();
  const out: M365RiskBlock[] = [];
  for (const risk of risks) {
    const key = `${risk.label}|${risk.detail ?? ""}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(risk);
  }
  return out;
}

function humanRelationshipSummary(
  raw: string,
  companyName: string,
  contactName: string | null,
): string {
  const who = contactName ? `${contactName} at ${companyName}` : companyName;
  const cleaned = sanitizeBriefingCopy(raw);

  if (
    /score driven|activity frequency|contact recency|stable trend|health report/i.test(
      cleaned,
    )
  ) {
    if (/weak|cold|at risk|thin/i.test(cleaned)) {
      return `${who} — relationship is thin; this conversation needs a clear ask and a named next step.`;
    }
    if (/strong|warm|healthy/i.test(cleaned)) {
      return `${who} — relationship is engaged; use the meeting to lock the next commercial step.`;
    }
    return `${who} — confirm what they need from us and agree the next concrete step.`;
  }

  const first = cleaned.split(/(?<=[.!?])\s+/)[0]?.trim() || cleaned;
  return first.length > 160 ? `${first.slice(0, 157)}…` : first;
}

function buildMeetingObjective(
  companyName: string,
  contactName: string | null,
  opportunities: M365OpportunityBlock[],
  risks: { label: string }[],
  nextAction: string,
): string {
  const withWhom = contactName ? `${contactName} (${companyName})` : companyName;
  if (opportunities.length > 0 && risks.length > 0) {
    return `Align with ${withWhom} on ${opportunities[0]!.label} — address ${risks[0]!.label.toLowerCase()}.`;
  }
  if (opportunities.length > 0) {
    return `Advance ${opportunities[0]!.label} with ${withWhom}.`;
  }
  if (risks.length > 0) {
    return `Resolve ${risks[0]!.label.toLowerCase()} and strengthen the ${companyName} relationship.`;
  }
  return nextAction;
}

function buildWhatChanged(
  snapshot: ReturnType<typeof buildCompany360Snapshot>,
  topRisks: M365RiskBlock[],
): string[] {
  const lines: string[] = [];
  const riskLabels = new Set(topRisks.map((r) => r.label.toLowerCase()));

  const recent = snapshot.activities[0];
  if (recent) {
    lines.push(
      `Last interaction: ${recent.Subject} (${formatRelativeTime(recent.ActivityDate)})`,
    );
  } else {
    lines.push("No recorded contact — start building the relationship timeline.");
  }

  for (const risk of snapshot.intelligence.riskSignals.slice(0, 2)) {
    if (riskLabels.has(risk.label.toLowerCase())) continue;
    lines.push(sanitizeBriefingCopy(`${risk.label} — ${risk.detail}`));
  }

  return lines;
}

function buildDiscussionTopics(
  contactName: string | null,
  opportunities: M365OpportunityBlock[],
  risks: { label: string }[],
): string[] {
  const topics: string[] = [];
  const person = contactName?.trim() || "they";

  topics.push(`What does ${person} need from us this quarter?`);

  if (opportunities[0]) {
    topics.push(`What is blocking progress on ${opportunities[0].label}?`);
  }

  const stakeholderRisk = risks.find((r) =>
    /stakeholder|single|coverage|champion|decision/i.test(r.label),
  );
  if (stakeholderRisk) {
    topics.push("Who else should be involved before we advance?");
  } else {
    topics.push("What is the concrete next step — and by when?");
  }

  return topics;
}
