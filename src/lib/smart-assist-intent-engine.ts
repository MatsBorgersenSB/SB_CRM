import type { Activity } from "@/types/activity";
import type { CommercialPackage } from "@/types/commercial-package";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import { formatDealValue } from "@/types/pipeline";
import {
  buildPortfolioCommercialViability,
  computeCommercialViability,
} from "@/lib/commercial-viability-engine";
import { getActivitiesForDeal, isFollowUpOpen, isFollowUpOverdue } from "@/lib/activity-utils";
import { deal360Href } from "@/types/relationship-navigation";
import type { SmartAssistCommandResult } from "@/types/smart-assist";
import type { SmartSearchContext } from "@/lib/smart-search-ask-engine";
import { buildContextFirstAnswer } from "@/lib/smart-assist-conversation-engine";

export type SmartAssistNlIntent =
  | "opportunity_assessment"
  | "blocking"
  | "next_action"
  | "what_to_sell"
  | "fastest_revenue"
  | "seriousness"
  | "worth_resources"
  | "portfolio_priority";

const ASSESSMENT_PREFIXES = [
  /^evaluate\s+/i,
  /^assess\s+/i,
  /^how good is\s+/i,
  /^should we pursue\s+/i,
  /^what do you think about\s+/i,
  /^what do you think of\s+/i,
  /^analyze\s+/i,
  /^review\s+/i,
  /^tell me about\s+/i,
  /^will\s+.+\s+close\??$/i,
  /^is\s+.+\s+worth pursuing\??$/i,
];

function normalize(text: string): string {
  return text.toLowerCase().trim().replace(/\?+$/, "");
}

function matchesAny(text: string, patterns: (string | RegExp)[]): boolean {
  return patterns.some((pattern) =>
    typeof pattern === "string" ? text.includes(pattern) : pattern.test(text),
  );
}

export function extractDealId(text: string): string | null {
  const match = text.match(/\b(PL|FQ|DS)-\d{4}\b/i);
  return match ? match[0]!.toUpperCase() : null;
}

function stripAssessmentPhrases(query: string): string {
  let cleaned = query.trim();
  for (const pattern of ASSESSMENT_PREFIXES) {
    cleaned = cleaned.replace(pattern, "");
  }
  return cleaned
    .replace(/\?+$/, "")
    .replace(/^(will|does|is|are|can|should|what about)\s+/i, "")
    .trim();
}

export function findPipelineForQuery(
  query: string,
  pipelines: PipelineRow[],
  companies: Company[],
): PipelineRow | undefined {
  const dealId = extractDealId(query);
  if (dealId) return pipelines.find((p) => p.id === dealId);

  const q = normalize(query);
  const cleaned = normalize(stripAssessmentPhrases(query));
  if (!cleaned) return undefined;

  const byAsset = pipelines.find(
    (p) =>
      p.assetName?.toLowerCase() === cleaned ||
      p.assetName?.toLowerCase().includes(cleaned) ||
      cleaned.includes(p.assetName?.toLowerCase() ?? ""),
  );
  if (byAsset) return byAsset;

  const tokens = cleaned.split(/\s+/).filter((t) => t.length > 3);
  if (tokens.length > 0) {
    const scored = pipelines
      .map((p) => {
        const name = (p.assetName ?? "").toLowerCase();
        const hits = tokens.filter((t) => name.includes(t)).length;
        return { pipeline: p, hits };
      })
      .filter((row) => row.hits > 0)
      .sort((a, b) => b.hits - a.hits);
    if (scored[0] && scored[0].hits >= Math.min(2, tokens.length)) {
      return scored[0].pipeline;
    }
  }

  const company = companies.find(
    (c) =>
      q.includes(c.Title.toLowerCase()) ||
      cleaned.includes(c.Title.toLowerCase()) ||
      c.Title.toLowerCase().includes(cleaned),
  );
  if (company) {
    const linked = pipelines.find((p) => company.pipelineIds.includes(p.id));
    if (linked) return linked;
  }

  return undefined;
}

export function classifyNaturalLanguageIntent(query: string): SmartAssistNlIntent | null {
  const q = normalize(query);
  if (!q) return null;

  if (
    matchesAny(q, [
      "blocking",
      "preventing",
      "holding up",
      "hold up",
      "stuck",
      "what is wrong",
      "what's wrong",
      "why no contract",
      "why hasn't",
    ])
  ) {
    return "blocking";
  }
  if (
    matchesAny(q, [
      "what should we do next",
      "what do we do next",
      "what's next",
      "whats next",
      "next step",
      "next action",
      "what next",
    ])
  ) {
    return "next_action";
  }
  if (
    matchesAny(q, [
      "what should we sell",
      "sell next",
      "revenue path",
      "what to sell",
    ])
  ) {
    return "what_to_sell";
  }
  if (matchesAny(q, ["fastest path", "fastest route", "fastest way", "quick path to revenue"])) {
    return "fastest_revenue";
  }
  if (
    matchesAny(q, [
      "are they serious",
      "are these guys serious",
      "serious buyer",
      "genuine interest",
      "do they mean it",
      "real opportunity",
    ])
  ) {
    return "seriousness";
  }
  if (
    matchesAny(q, [
      "worth our resources",
      "worth our time",
      "worth the effort",
      "invest more",
      "invest additional",
      "should we invest",
    ])
  ) {
    return "worth_resources";
  }
  if (
    matchesAny(q, [
      "which opportunit",
      "deserve attention",
      "prioritize",
      "where should we focus",
      "best opportunit",
      "top deals",
    ])
  ) {
    return "portfolio_priority";
  }
  if (
    matchesAny(q, [
      "evaluate ",
      "assess ",
      "how good is ",
      "should we pursue ",
      "what do you think about ",
      "what do you think of ",
      "commercial viability",
      "contract probability",
      "will ",
      "close?",
      "close ",
      "viability",
      "pursue ",
    ]) ||
    ASSESSMENT_PREFIXES.some((pattern) => pattern.test(query.trim()))
  ) {
    return "opportunity_assessment";
  }

  return null;
}

function resolveTargetDeal(
  query: string,
  ctx: SmartSearchContext,
): PipelineRow | undefined {
  const explicit = findPipelineForQuery(query, ctx.pipelines, ctx.companies);
  if (explicit) return explicit;

  const active = ctx.pipelines.filter((p) =>
    ["Prospecting", "Feedstock Analysis", "Contract Negotiation"].includes(p.status),
  );
  if (active.length === 1) return active[0];
  return undefined;
}

function assessDeal(deal: PipelineRow, ctx: SmartSearchContext) {
  return computeCommercialViability(
    deal,
    ctx.companies,
    ctx.activities,
    ctx.pipelines,
    ctx.commercialPackages,
  );
}

function operationalSignals(deal: PipelineRow, activities: Activity[]) {
  const dealActivities = getActivitiesForDeal(activities, deal.id);
  const openCommitments = dealActivities.filter(isFollowUpOpen);
  const overdue = openCommitments.filter(isFollowUpOverdue);
  return { dealActivities, openCommitments, overdue };
}

function partialPreamble(deal: PipelineRow, dealActivities: Activity[]): string | null {
  if (dealActivities.length >= 2) return null;
  return "I do not have enough information for a complete assessment.\n\nHowever based on current CRM information:";
}

function formatDealBasics(deal: PipelineRow): string {
  return [
    `• Opportunity Value ${formatDealValue(deal.currency, deal.salesValue)}`,
    `• Stage: ${deal.status}`,
    `• Probability: ${deal.probability}%`,
  ].join("\n");
}

function resultForAssessment(
  deal: PipelineRow,
  ctx: SmartSearchContext,
  focus: string,
): SmartAssistCommandResult {
  const assessment = assessDeal(deal, ctx);
  const { dealActivities, openCommitments, overdue } = operationalSignals(deal, ctx.activities);
  const preamble = partialPreamble(deal, dealActivities);
  const q = assessment.coreQuestions;

  const lines = [
    preamble,
    preamble ? formatDealBasics(deal) : null,
    preamble
      ? deal.salesValue >= 1_000_000
        ? "This appears to be a significant opportunity."
        : "This is an early-stage opportunity — qualify before major investment."
      : null,
    "",
    `${deal.assetName} — ${assessment.recommendationLabel}`,
    `Contract readiness: ${assessment.contractReadiness.percent}% · Win probability: ${assessment.contractProbabilityLabel}`,
    `Value: ${assessment.salesValueLabel} · Stage: ${deal.status}`,
    "",
    focus,
    "",
    `Recommended next action: ${assessment.nextActions[0]?.action ?? assessment.revenuePath.whatToSellNext}`,
    overdue.length > 0
      ? `⚠ ${overdue.length} overdue follow-up${overdue.length === 1 ? "" : "s"} on this deal`
      : null,
    openCommitments.length > 0
      ? `• ${openCommitments.length} open commitment${openCommitments.length === 1 ? "" : "s"}`
      : null,
  ].filter((line) => line !== null);

  return {
    intent: "commercial_intelligence",
    dealId: deal.id,
    openCoach: true,
    summary: lines.join("\n"),
    actionLabel: "Full CVM assessment",
    href: `${deal360Href(deal.id)}#viability`,
  };
}

export function answerNaturalLanguage(
  query: string,
  ctx: SmartSearchContext,
): SmartAssistCommandResult | null {
  const intent = classifyNaturalLanguageIntent(query);
  if (!intent) return null;

  if (intent === "portfolio_priority") {
    const ranked = buildPortfolioCommercialViability(
      ctx.pipelines,
      ctx.companies,
      ctx.activities,
      ctx.commercialPackages,
      5,
    );
    if (ranked.length === 0) {
      return {
        intent: "ask",
        summary: [
          "No active sales opportunities in your pipeline right now.",
          "",
          "Recommended next action: Build qualified pipeline through prospecting and feedstock validation engagements.",
        ].join("\n"),
        actionLabel: "View opportunities",
        href: "/opportunities",
      };
    }

    const lines = ranked.map(
      (brief, i) =>
        `${i + 1}. ${brief.dealName} — ${brief.contractProbabilityLabel} · ${brief.recommendationLabel.split("—")[0]?.trim()}`,
    );
    return {
      intent: "ask",
      summary: [
        "Opportunities that deserve attention right now:",
        "",
        ...lines,
        "",
        `Top priority: ${ranked[0]!.dealName}`,
        `Recommended: ${ranked[0]!.recommendedNextAction}`,
      ].join("\n"),
      actionLabel: "Review top opportunity",
      href: ranked[0]!.href,
      dealId: ranked[0]!.dealId,
      openCoach: true,
    };
  }

  const deal = resolveTargetDeal(query, ctx);
  if (!deal) {
    const active = ctx.pipelines.filter((p) =>
      ["Prospecting", "Feedstock Analysis", "Contract Negotiation"].includes(p.status),
    );
    return {
      intent: "ask",
      summary: [
        "I can assess a specific opportunity — name the project or include an ID (e.g. PL-1042).",
        "",
        active.length > 0
          ? `Active opportunities include: ${active
              .slice(0, 4)
              .map((p) => p.assetName)
              .join(", ")}`
          : "No active sales-stage opportunities found in CRM.",
        "",
        "Recommended next action: Open your pipeline and select the deal to assess.",
      ].join("\n"),
      actionLabel: "View opportunities",
      href: "/opportunities",
    };
  }

  const assessment = assessDeal(deal, ctx);
  const q = assessment.coreQuestions;

  switch (intent) {
    case "opportunity_assessment":
      return resultForAssessment(
        deal,
        ctx,
        [
          q.shouldInvestResources,
          q.whyAttractive ? `Why attractive: ${q.whyAttractive}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      );
    case "blocking":
      return resultForAssessment(
        deal,
        ctx,
        [
          "What is preventing a signed contract:",
          q.preventingSignedContract,
          assessment.fatalFlawAlerts[0]
            ? `Fatal flaw: ${assessment.fatalFlawAlerts[0].label} — ${assessment.fatalFlawAlerts[0].recommendedAction}`
            : null,
        ]
          .filter(Boolean)
          .join("\n"),
      );
    case "next_action":
      return resultForAssessment(
        deal,
        ctx,
        [
          `Next best action: ${assessment.nextActions[0]?.action ?? q.whatToSellNext}`,
          assessment.nextActions[0]?.reason ?? q.bestRevenuePath,
        ].join("\n"),
      );
    case "what_to_sell":
      return resultForAssessment(
        deal,
        ctx,
        [`What to sell next: ${q.whatToSellNext}`, q.bestRevenuePath].join("\n"),
      );
    case "fastest_revenue":
      return resultForAssessment(
        deal,
        ctx,
        [`Fastest path to revenue: ${q.fastestPathToRevenue}`, q.bestRevenuePath].join("\n"),
      );
    case "seriousness": {
      const sponsorFlaw = assessment.fatalFlawAlerts.find((f) =>
        ["no_sponsor", "no_decision_maker", "commercial_stall"].includes(f.id),
      );
      return resultForAssessment(
        deal,
        ctx,
        [
          "Decision readiness & stakeholder engagement:",
          q.canCustomerDecide,
          q.isDealProgressing,
          sponsorFlaw
            ? `Concern: ${sponsorFlaw.detail} — ${sponsorFlaw.recommendedAction}`
            : "No critical sponsor or engagement gaps detected from CRM data.",
        ].join("\n"),
      );
    }
    case "worth_resources":
      return resultForAssessment(
        deal,
        ctx,
        [q.isWorthOurResources, q.shouldInvestResources].join("\n"),
      );
    default:
      return null;
  }
}

export function buildNeverFailFallback(
  query: string,
  ctx: SmartSearchContext,
): SmartAssistCommandResult {
  const deal = resolveTargetDeal(query, ctx);
  if (deal) {
    return resultForAssessment(
      deal,
      ctx,
      "Here is the best assessment from available CRM data.",
    );
  }

  return buildContextFirstAnswer(query, {
    companies: ctx.companies,
    pipelines: ctx.pipelines,
    activities: ctx.activities,
    commercialPackages: ctx.commercialPackages,
    index: ctx.index,
    user: ctx.user,
  });
}
