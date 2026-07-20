import type { Activity } from "@/types/activity";
import type { CommercialPackage } from "@/types/commercial-package";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import { formatDealValue } from "@/types/pipeline";
import {
  getActivitiesForDeal,
  isFollowUpOpen,
  isFollowUpOverdue,
} from "@/lib/activity-utils";
import { buildOpportunityCommandCenter } from "@/lib/opportunity-command-center-data";
import { buildPortfolioCommercialViability } from "@/lib/commercial-viability-engine";
import { buildRelationshipCommandCenter } from "@/lib/relationship-intelligence";
import { buildAttentionItems } from "@/lib/smart-attention-engine";
import { buildCoPilotProposals } from "@/lib/smartassist-copilot-engine";
import { daysBetween } from "@/lib/relative-time";
import { company360Href } from "@/types/company-360";
import { deal360Href } from "@/types/relationship-navigation";
import type { SmartAssistCommandResult, SmartAssistFocus } from "@/types/smart-assist";
import type { AuthUser } from "@/types/auth";
import type { SearchIndexItem } from "@/types/universal-search";
import type { BusinessImpactRecommendation } from "@/types/smart-assist-business-impact";
import {
  attentionItemToBusinessImpact,
  applyCategoryWeight,
  businessImpactIntro,
  copilotProposalToBusinessImpact,
  formatBusinessImpactSummary,
  opportunityRiskToBusinessImpact,
  overdueCommitmentToBusinessImpact,
  rankBusinessImpactRecommendations,
  relationshipRiskToBusinessImpact,
} from "@/lib/smart-assist-business-impact";
import { SMARTASSIST_BUSINESS_IMPACT } from "@/lib/smart-assist-config";

export type SmartAssistConversationContext = {
  companies: Company[];
  pipelines: PipelineRow[];
  activities: Activity[];
  commercialPackages: CommercialPackage[];
  index: SearchIndexItem[];
  user: AuthUser;
  pathname?: string;
  focus?: SmartAssistFocus | null;
};

export type ConversationalIntent =
  | "focus_today"
  | "forgetfulness"
  | "importance_now"
  | "next_action_general"
  | "at_risk_customer"
  | "at_risk_opportunity"
  | "general_business";

export type ParsedPageContext = {
  page: string;
  companyId?: string;
  contactId?: string;
  dealId?: string;
  activityId?: string;
};

function normalize(text: string): string {
  return text.toLowerCase().trim().replace(/\?+$/, "").replace(/'/g, "'");
}

function matchesAny(text: string, patterns: string[]): boolean {
  return patterns.some((pattern) => text.includes(pattern));
}

export function parsePageContext(pathname?: string): ParsedPageContext {
  if (!pathname) return { page: "portfolio" };

  const segments = pathname.split("/").filter(Boolean);
  const page = segments[0] ?? "portfolio";

  if (page === "companies" && segments[1]) {
    return { page: "company", companyId: segments[1] };
  }
  if (page === "contacts" && segments[1]) {
    return { page: "contact", contactId: segments[1] };
  }
  if ((page === "deals" || page === "opportunities") && segments[1]) {
    return { page: "opportunity", dealId: decodeURIComponent(segments[1]!) };
  }
  if (page === "activities" && segments[1]) {
    return { page: "activity", activityId: segments[1] };
  }

  return { page };
}

export function classifyConversationalIntent(query: string): ConversationalIntent | null {
  const q = normalize(query);
  if (!q) return null;

  if (
    matchesAny(q, [
      "what am i forgetting",
      "what have i forgotten",
      "what have i missed",
      "what did i miss",
      "falling behind",
      "neglected",
      "what needs attention",
      "what have i overlooked",
      "anything i missed",
      "what am i missing",
    ])
  ) {
    return "forgetfulness";
  }

  if (
    matchesAny(q, [
      "focus on today",
      "focus today",
      "should i focus",
      "what to focus",
      "what should i focus",
      "what deserves my attention",
      "deserve attention",
      "what is important today",
      "what's important today",
      "important today",
      "priorities today",
      "priority today",
      "my priorities",
      "start my day",
      "start the day",
    ])
  ) {
    return "focus_today";
  }

  if (
    matchesAny(q, [
      "most important right now",
      "most important now",
      "what is important",
      "what's important",
      "urgent right now",
      "critical right now",
      "top priority",
    ])
  ) {
    return "importance_now";
  }

  if (
    matchesAny(q, [
      "customer at risk",
      "which customer is at risk",
      "which customers are at risk",
      "relationship at risk",
      "relationship risk",
      "account at risk",
      "accounts at risk",
      "declining relationship",
      "relationship health",
      "customer risk",
    ])
  ) {
    return "at_risk_customer";
  }

  if (
    matchesAny(q, [
      "which opportunity deserves",
      "opportunity deserve",
      "which deal deserves",
      "deal at risk",
      "opportunity at risk",
      "pipeline risk",
      "which opportunity",
      "best opportunity",
      "top opportunity",
      "where should i focus commercially",
    ])
  ) {
    return "at_risk_opportunity";
  }

  if (
    matchesAny(q, [
      "what should i do next",
      "what do i do next",
      "what should i do now",
      "what do i do now",
      "what next",
      "whats next",
      "next step for me",
      "recommend next",
    ])
  ) {
    return "next_action_general";
  }

  if (
    matchesAny(q, [
      "help me understand",
      "what can you tell me",
      "give me an overview",
      "summarize my",
      "summary of my",
    ])
  ) {
    return "general_business";
  }

  return null;
}

function computeRawImpactScore(input: {
  revenueWeight: number;
  relationshipWeight: number;
  opportunityWeight: number;
  contractReadinessWeight: number;
  pageBoost?: number;
}): number {
  const base =
    input.revenueWeight * 0.35 +
    input.relationshipWeight * 0.25 +
    input.opportunityWeight * 0.25 +
    input.contractReadinessWeight * 0.15;
  return Math.min(100, Math.round(base + (input.pageBoost ?? 0)));
}

export function gatherBusinessImpactRecommendations(
  ctx: SmartAssistConversationContext,
): BusinessImpactRecommendation[] {
  const recommendations: BusinessImpactRecommendation[] = [];
  const page = parsePageContext(ctx.pathname);
  const pageCompany = page.companyId
    ? ctx.companies.find((c) => c.CompanyID === page.companyId)
    : undefined;
  const pageDeal = page.dealId
    ? ctx.pipelines.find((p) => p.id === page.dealId)
    : undefined;

  const commandCenter = buildRelationshipCommandCenter(
    ctx.companies,
    ctx.pipelines,
    ctx.activities,
  );
  const oppCenter = buildOpportunityCommandCenter(
    ctx.pipelines,
    ctx.companies,
    ctx.activities,
  );
  const attentionItems = buildAttentionItems({
    companies: ctx.companies,
    pipelines: ctx.pipelines,
    activities: ctx.activities,
    commercialPackages: ctx.commercialPackages,
  }).filter((item) => item.status === "open");

  const copilotProposals =
    ctx.focus?.copilotProposals ??
    buildCoPilotProposals(
      ctx.companies,
      ctx.pipelines,
      ctx.activities,
      ctx.commercialPackages,
    );

  for (const deal of oppCenter.dealsAtRisk.slice(0, 6)) {
    const pageBoost = page.dealId === deal.dealId ? 15 : 0;
    const rawScore = computeRawImpactScore({
      revenueWeight: Math.min(100, Math.round(deal.salesValue / 1_500_000) * 30 + 40),
      relationshipWeight: 40,
      opportunityWeight: 90,
      contractReadinessWeight: deal.healthScore,
      pageBoost,
    });

    recommendations.push(
      opportunityRiskToBusinessImpact({
        id: `deal-risk-${deal.dealId}`,
        entityName: deal.dealName,
        healthStatus: deal.healthStatus,
        healthSummary: deal.healthSummary,
        dealValueLabel: formatDealValue(deal.currency, deal.salesValue),
        recommendedAction:
          deal.nextBestAction?.action ?? "Review commercial viability and address blockers",
        impactScore: rawScore,
        href: deal.href,
      }),
    );
  }

  for (const rel of commandCenter.relationshipsNeedingAttention) {
    const company = ctx.companies.find((c) => c.CompanyID === rel.companyId);
    const topDeal = company?.pipelineIds
      .map((id) => ctx.pipelines.find((p) => p.id === id))
      .filter(Boolean)
      .sort((a, b) => (b?.salesValue ?? 0) - (a?.salesValue ?? 0))[0];

    const pageBoost = page.companyId === rel.companyId ? 12 : 0;
    const rawScore = computeRawImpactScore({
      revenueWeight: topDeal ? Math.min(90, Math.round(topDeal.salesValue / 1_000_000) * 20) : 25,
      relationshipWeight: rel.healthScore < 40 ? 95 : 70,
      opportunityWeight: rel.reason === "stalled_opportunity" ? 85 : 45,
      contractReadinessWeight: 35,
      pageBoost,
    });

    const action =
      rel.reason === "no_recent_contact"
        ? "Schedule a follow-up call to re-establish contact"
        : rel.reason === "overdue_followup"
          ? "Close the open commitment and confirm next steps with the customer"
          : rel.recommendedAction.action;

    recommendations.push(
      relationshipRiskToBusinessImpact({
        id: `rel-${rel.companyId}`,
        entityName: rel.companyName,
        headline:
          rel.reason === "no_recent_contact"
            ? "Relationship health is declining and no recent contact has been recorded"
            : rel.detail,
        reason: rel.reason,
        recommendedAction: action,
        dealValueLabel: topDeal ? formatDealValue(topDeal.currency, topDeal.salesValue) : undefined,
        impactScore: rawScore,
        href: rel.href ?? company360Href(rel.companyId, "attention"),
      }),
    );
  }

  for (const activity of ctx.activities) {
    if (!isFollowUpOpen(activity)) continue;
    if (!isFollowUpOverdue(activity)) continue;

    const daysLate = activity.NextActionDate
      ? Math.max(0, -daysBetween(activity.NextActionDate))
      : 0;
    const deal = ctx.pipelines.find((p) => p.id === activity.Deal?.Title);
    const revenueWeight = deal
      ? Math.min(100, Math.round((deal.salesValue / 2_000_000) * 100))
      : 30;

    const pageBoost =
      page.activityId === activity.ActivityID ||
      (pageCompany && activity.Company?.Title === pageCompany.Title)
        ? 10
        : 0;

    const rawScore = computeRawImpactScore({
      revenueWeight,
      relationshipWeight: 70,
      opportunityWeight: deal ? 65 : 35,
      contractReadinessWeight: 40,
      pageBoost,
    });

    recommendations.push(
      overdueCommitmentToBusinessImpact({
        id: `overdue-${activity.ActivityID}`,
        entityName: activity.Company?.Title ?? activity.Subject,
        daysLate,
        commitmentText: activity.NextAction || activity.Subject,
        dealValueLabel: deal ? formatDealValue(deal.currency, deal.salesValue) : undefined,
        impactScore: rawScore,
        href: `/activities/${activity.ActivityID}`,
      }),
    );
  }

  for (const item of attentionItems.slice(0, 6)) {
    if (recommendations.some((r) => r.id.includes(item.sourceObjectId))) continue;

    const rawScore = computeRawImpactScore({
      revenueWeight: item.severity === "urgent" ? 80 : 45,
      relationshipWeight: item.objectType === "Company" || item.objectType === "Contact" ? 75 : 35,
      opportunityWeight: item.objectType === "Opportunity" ? 80 : 30,
      contractReadinessWeight: item.objectType === "Document" ? 65 : 25,
    });

    recommendations.push(
      attentionItemToBusinessImpact({
        id: `attention-${item.id}`,
        entityName: item.companyName ?? item.sourceObjectName,
        situation: item.recommendation,
        severity: item.severity,
        recommendedAction: item.suggestedAiAction,
        impactScore: rawScore,
        href: item.href,
        source: "Attention engine",
      }),
    );
  }

  for (const proposal of copilotProposals) {
    const pageBoost =
      (pageCompany && proposal.companyName === pageCompany.Title) ||
      (pageDeal && proposal.objectName?.includes(pageDeal.assetName ?? pageDeal.id))
        ? 10
        : 0;
    const rawScore = computeRawImpactScore({
      revenueWeight: proposal.severity === "urgent" ? 75 : 50,
      relationshipWeight: proposal.sourceType === "relationship" ? 80 : 40,
      opportunityWeight: proposal.sourceType === "opportunity" ? 85 : 35,
      contractReadinessWeight: proposal.sourceType === "document" ? 70 : 30,
      pageBoost,
    });

    recommendations.push(copilotProposalToBusinessImpact(proposal, rawScore));
  }

  return rankBusinessImpactRecommendations(recommendations);
}

function introForIntent(intent: ConversationalIntent, displayName: string): string {
  const intros = SMARTASSIST_BUSINESS_IMPACT.intros;
  switch (intent) {
    case "focus_today":
      return businessImpactIntro(displayName, intros.focus_today);
    case "forgetfulness":
      return businessImpactIntro(displayName, intros.forgetfulness);
    case "importance_now":
      return businessImpactIntro(displayName, intros.importance_now);
    case "next_action_general":
      return businessImpactIntro(displayName, intros.next_action);
    case "at_risk_customer":
      return businessImpactIntro(displayName, intros.at_risk_customer);
    case "at_risk_opportunity":
      return businessImpactIntro(displayName, intros.at_risk_opportunity);
    default:
      return businessImpactIntro(displayName, intros.default);
  }
}

function filterForIntent(
  recommendations: BusinessImpactRecommendation[],
  intent: ConversationalIntent,
): BusinessImpactRecommendation[] {
  switch (intent) {
    case "at_risk_customer":
      return recommendations.filter(
        (r) => r.category === "relationship" || r.source === "Open commitment",
      );
    case "at_risk_opportunity":
      return recommendations.filter(
        (r) => r.category === "opportunity" || r.category === "commercial",
      );
    case "forgetfulness":
      return recommendations.filter((r) => r.category !== "crm_admin");
    case "focus_today":
    case "importance_now":
    case "next_action_general":
      return recommendations.filter((r) => r.category !== "crm_admin").concat(
        recommendations.filter((r) => r.category === "crm_admin").slice(0, 1),
      );
    default:
      return recommendations;
  }
}

function pageContextNote(ctx: SmartAssistConversationContext): string | null {
  const page = parsePageContext(ctx.pathname);
  if (page.page === "company" && page.companyId) {
    const company = ctx.companies.find((c) => c.CompanyID === page.companyId);
    if (company) return `Context: You are viewing ${company.Title}.`;
  }
  if (page.page === "opportunity" && page.dealId) {
    const deal = ctx.pipelines.find((p) => p.id === page.dealId);
    if (deal) return `Context: You are viewing ${deal.assetName ?? deal.id}.`;
  }
  if (page.page === "activity" && page.activityId) {
    const activity = ctx.activities.find((a) => a.ActivityID === page.activityId);
    if (activity) return `Context: You are viewing activity "${activity.Subject}".`;
  }
  return null;
}

function portfolioFallbackRecommendations(
  ctx: SmartAssistConversationContext,
): BusinessImpactRecommendation[] {
  const ranked = buildPortfolioCommercialViability(
    ctx.pipelines,
    ctx.companies,
    ctx.activities,
    ctx.commercialPackages,
    3,
  );

  return ranked.map((brief, i) => ({
    id: `cvm-${brief.dealId}`,
    entityName: brief.dealName,
    category: "opportunity" as const,
    situation: `${brief.headline} — ${brief.contractProbabilityLabel}`,
    impact: `Commercial viability ${brief.recommendationLabel.split("—")[0]?.trim() ?? "requires review"}`,
    recommendedAction: brief.recommendedNextAction,
    estimatedEffort: "20–30 minutes",
    expectedOutcome: "Deal progression aligned with revenue path; contract readiness improves.",
    priority: i === 0 ? "High" : "Medium",
    impactScore: applyCategoryWeight(90 - i * 10, "opportunity"),
    href: brief.href,
    source: "Commercial intelligence",
  }));
}

export function answerConversationalQuestion(
  query: string,
  ctx: SmartAssistConversationContext,
): SmartAssistCommandResult | null {
  const intent = classifyConversationalIntent(query);
  if (!intent || intent === "general_business") return null;

  let recommendations = gatherBusinessImpactRecommendations(ctx);
  recommendations = filterForIntent(recommendations, intent);
  const top = recommendations.slice(0, 4);
  const contextNote = pageContextNote(ctx);

  if (top.length === 0) {
    const fallback = portfolioFallbackRecommendations(ctx);
    const intro = introForIntent(intent, ctx.user.displayName);
    const summary =
      fallback.length > 0
        ? formatBusinessImpactSummary(intro, fallback.slice(0, 3), contextNote ?? undefined)
        : [
            intro,
            "",
            "Your portfolio is quiet on active commercial risks.",
            contextNote ?? "",
          ]
            .filter(Boolean)
            .join("\n");

    return {
      intent: "ask",
      summary,
      actionLabel: fallback[0] ? "Review opportunity" : "View opportunities",
      href: fallback[0]?.href ?? "/opportunities",
      dealId: fallback[0]?.href?.includes("/deals/")
        ? fallback[0].href.split("/deals/")[1]?.split("?")[0]
        : undefined,
      openCoach: Boolean(fallback[0]),
    };
  }

  const intro = introForIntent(intent, ctx.user.displayName);
  const topRec = top[0]!;
  const summary = formatBusinessImpactSummary(
    intro,
    top,
    [
      contextNote,
      "",
      `Highest business impact: ${topRec.entityName} — ${topRec.expectedOutcome}`,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  return {
    intent: "ask",
    summary,
    actionLabel:
      topRec.category === "crm_admin" ? "Review in Co-Pilot" : "Take action",
    href: topRec.href ?? "/opportunities",
    dealId: topRec.href?.includes("/deals/")
      ? topRec.href.split("/deals/")[1]?.split("?")[0]
      : undefined,
    openCoach: topRec.category === "opportunity" || topRec.category === "commercial",
  };
}

/** Always returns a useful business-impact answer — never fails empty. */
export function buildContextFirstAnswer(
  query: string,
  ctx: SmartAssistConversationContext,
): SmartAssistCommandResult {
  const conversational = answerConversationalQuestion(query, ctx);
  if (conversational) return conversational;

  const intent = classifyConversationalIntent(query) ?? "general_business";
  const recommendations = gatherBusinessImpactRecommendations(ctx);

  if (recommendations.length > 0) {
    return answerConversationalQuestion(
      intent === "general_business" ? "what should I focus on today?" : query,
      ctx,
    )!;
  }

  const page = parsePageContext(ctx.pathname);
  if (page.dealId) {
    const deal = ctx.pipelines.find((p) => p.id === page.dealId);
    if (deal) {
      const dealActivities = getActivitiesForDeal(ctx.activities, deal.id);
      const overdue = dealActivities.filter(isFollowUpOverdue).length;
      const rec = opportunityRiskToBusinessImpact({
        id: `page-deal-${deal.id}`,
        entityName: deal.assetName ?? deal.id,
        healthStatus: deal.status,
        healthSummary: `${overdue} overdue commitment${overdue === 1 ? "" : "s"} on this deal`,
        dealValueLabel: formatDealValue(deal.currency, deal.salesValue),
        recommendedAction: "Review commercial viability and address open blockers",
        impactScore: 75,
        href: deal360Href(deal.id),
      });

      return {
        intent: "ask",
        summary: formatBusinessImpactSummary(
          businessImpactIntro(ctx.user.displayName, `On ${rec.entityName}:`),
          [rec],
        ),
        actionLabel: "Open opportunity",
        href: deal360Href(deal.id),
        dealId: deal.id,
        openCoach: true,
      };
    }
  }

  const fallback = portfolioFallbackRecommendations(ctx);
  return {
    intent: "ask",
    summary: formatBusinessImpactSummary(
      businessImpactIntro(ctx.user.displayName, SMARTASSIST_BUSINESS_IMPACT.intros.default),
      fallback.length > 0 ? fallback : [
        {
          id: "portfolio-quiet",
          entityName: "Portfolio",
          category: "commercial",
          situation: "No urgent commercial risks detected in current CRM data.",
          impact: "Low immediate risk — focus on building pipeline intelligence.",
          recommendedAction: "Log customer interactions on active opportunities",
          estimatedEffort: "10 minutes",
          expectedOutcome: "Commercial assessments become available for prioritisation.",
          priority: "Medium",
          impactScore: 40,
          href: "/activities",
          source: "Portfolio",
        },
      ],
      `I interpreted: "${query}"`,
    ),
    actionLabel: "View pipeline",
    href: "/opportunities",
  };
}

/** Map a copilot proposal for UI display in business impact mode. */
export function proposalAsBusinessImpact(
  proposal: import("@/types/smartassist-copilot").CoPilotActionProposal,
  impactScore = 50,
): BusinessImpactRecommendation {
  return copilotProposalToBusinessImpact(proposal, impactScore);
}
