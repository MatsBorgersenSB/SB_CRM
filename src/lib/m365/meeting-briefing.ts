import { buildCompany360Snapshot } from "@/lib/company-360-data";
import { computeOpportunityIntelligence } from "@/lib/opportunity-intelligence-engine";
import { buildCompanyCopilotSummary } from "@/lib/smartcrm-copilot-engine";
import { formatDealValue } from "@/types/pipeline";
import { formatRelativeTime } from "@/lib/relative-time";
import { buildM365Meta } from "@/lib/m365/meta";
import {
  toM365Action,
  toM365RiskFromCompanySignal,
  toM365RiskFromDealSignal,
} from "@/lib/m365/blocks";
import type { M365DataContext } from "@/lib/m365/resolve-context";
import type { Company } from "@/types/company";
import type { M365MeetingBriefingPayload, M365OpportunityBlock } from "@/types/m365";
import { M365_BUDGETS, capItems } from "@/types/m365";
import { company360Href } from "@/types/company-360";
import { ensureImpact } from "@/lib/m365/meta";

export function buildM365MeetingBriefing(
  company: Company,
  ctx: M365DataContext,
): M365MeetingBriefingPayload {
  const snapshot = buildCompany360Snapshot(
    company,
    ctx.pipelines,
    ctx.activities,
    ctx.inventory,
  );

  const copilot = buildCompanyCopilotSummary(snapshot, ctx.activities);
  const { header, intelligence, pipelines } = snapshot;

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

      return {
        id: intel.dealId,
        label: intel.dealName,
        stage: intel.stage,
        valueLabel,
        healthScore: intel.healthScore,
        impact: ensureImpact(
          [
            intel.healthSummary,
            topDealRisk ? `${topDealRisk.label} — ${topDealRisk.detail}` : "",
            `${intel.winProbability}% win probability`,
          ],
          `${valueLabel} in ${intel.stage}`,
        ),
        href: company360Href(company.CompanyID, "opportunities"),
      };
    }),
    M365_BUDGETS.meetingBriefing.maxOpportunities,
  );

  const companyRisks = intelligence.riskSignals.map(toM365RiskFromCompanySignal);

  const dealRisks = pipelines.flatMap((pipeline) => {
    const intel = computeOpportunityIntelligence(
      pipeline,
      [company],
      ctx.activities,
      ctx.pipelines,
    );
    return intel.risks.map((risk) =>
      toM365RiskFromDealSignal(
        risk,
        `${formatDealValue(intel.currency, intel.salesValue)} deal exposure`,
      ),
    );
  });

  const topRisks = capItems(
    [...companyRisks, ...dealRisks].sort((a, b) => {
      const rank = { critical: 0, warning: 1, info: 2 };
      return rank[a.severity] - rank[b.severity];
    }),
    M365_BUDGETS.meetingBriefing.maxRisks,
  );

  const whatChanged = capItems(buildWhatChanged(snapshot, copilot.headline), M365_BUDGETS.meetingBriefing.maxWhatChanged);

  const discussionTopics = capItems(
    buildDiscussionTopics(intelligence, opportunities, topRisks),
    M365_BUDGETS.meetingBriefing.maxDiscussionTopics,
  );

  const nextBestAction = toM365Action(intelligence.recommendedAction, company.CompanyID);

  const meetingObjective = buildMeetingObjective(
    company.Title,
    opportunities,
    topRisks,
    nextBestAction.action,
  );

  const primaryRisk = topRisks[0]?.label ?? "No urgent risks";

  return {
    kind: "meeting-briefing",
    meta: buildM365Meta({
      whatMatters: copilot.headline,
      whatIsAtRisk: primaryRisk,
      whyItMatters: topRisks[0]?.impact ?? [copilot.relationshipSummary],
      whatShouldHappenNext: nextBestAction.action,
    }),
    companyName: company.Title,
    meetingObjective,
    relationshipSummary: copilot.relationshipSummary,
    whatChanged,
    openOpportunities: opportunities,
    topRisks,
    discussionTopics,
    nextBestAction,
    deepLink: company360Href(company.CompanyID),
  };
}

function buildMeetingObjective(
  companyName: string,
  opportunities: M365OpportunityBlock[],
  risks: { label: string }[],
  nextAction: string,
): string {
  if (opportunities.length > 0 && risks.length > 0) {
    return `Align with ${companyName} on ${opportunities[0]!.label} while addressing ${risks[0]!.label.toLowerCase()}.`;
  }
  if (opportunities.length > 0) {
    return `Advance ${opportunities[0]!.label} with ${companyName}.`;
  }
  if (risks.length > 0) {
    return `Resolve ${risks[0]!.label.toLowerCase()} and strengthen the ${companyName} relationship.`;
  }
  return nextAction;
}

function buildWhatChanged(
  snapshot: ReturnType<typeof buildCompany360Snapshot>,
  headline: string,
): string[] {
  const lines: string[] = [];

  for (const risk of snapshot.intelligence.riskSignals.slice(0, 2)) {
    lines.push(`${risk.label} — ${risk.detail}`);
  }

  const recent = snapshot.activities[0];
  if (recent) {
    lines.push(`Last interaction: ${recent.Subject} (${formatRelativeTime(recent.ActivityDate)})`);
  }

  if (lines.length === 0) {
    lines.push(headline);
  }

  return lines;
}

function buildDiscussionTopics(
  intelligence: ReturnType<typeof buildCompany360Snapshot>["intelligence"],
  opportunities: M365OpportunityBlock[],
  risks: { label: string; impact: string[] }[],
): string[] {
  const topics: string[] = [];

  if (risks[0]) {
    topics.push(`Address: ${risks[0].label}`);
  }

  if (opportunities[0]) {
    topics.push(`Progress: ${opportunities[0].label} (${opportunities[0].stage})`);
  }

  topics.push(`Confirm next step: ${intelligence.recommendedAction.action}`);

  for (const risk of risks.slice(1, 3)) {
    topics.push(risk.label);
  }

  return topics.filter((topic, index, all) => all.indexOf(topic) === index);
}
