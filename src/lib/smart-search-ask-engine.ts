import { buildCompanyOperationsWorkspace } from "@/lib/company-operations-data";
import {
  filterCompaniesByType,
  isStrategicCustomer,
  isStrategicCustomersQuery,
  matchCompanyTypeQuery,
  normalizeCompanyTypes,
} from "@/lib/company-classification";
import { buildCompanySummariesForCompanies } from "@/lib/relationship-intelligence";
import { buildDailyBriefing } from "@/lib/smartcrm-copilot-engine";
import {
  buildOpportunityOperationsWorkspace,
  filterOpportunityOperationsRows,
  sortOpportunityOperationsRows,
} from "@/lib/opportunity-operations-data";
import { buildAttentionItems } from "@/lib/smart-attention-engine";
import { resolveAttentionActions } from "@/lib/attention-action-resolver";
import { daysBetween } from "@/lib/relative-time";
import type { Activity } from "@/types/activity";
import type { AuthUser } from "@/types/auth";
import type { CommercialPackage } from "@/types/commercial-package";
import { COMMERCIAL_PACKAGE_KIND_LABELS, isQuotationKind } from "@/types/commercial-package";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import { formatDealValue } from "@/types/pipeline";
import type { AskSearchResult, SearchCommand, SearchIndexItem } from "@/types/universal-search";
import { ASK_SUGGESTED_QUESTIONS, SEARCH_COMMANDS } from "@/types/universal-search";
import { deal360Href } from "@/types/relationship-navigation";
import { company360Href } from "@/types/company-360";

export type SmartSearchContext = {
  companies: Company[];
  pipelines: PipelineRow[];
  activities: Activity[];
  commercialPackages: CommercialPackage[];
  index: SearchIndexItem[];
  user: AuthUser;
};

function normalize(text: string): string {
  return text.toLowerCase().trim().replace(/\?+$/, "");
}

function indexItemToResult(item: SearchIndexItem): SearchIndexItem {
  return item;
}

export function matchSearchCommands(query: string): SearchCommand[] {
  const q = normalize(query);
  if (!q) return [];

  return SEARCH_COMMANDS.filter((command) =>
    command.keywords.some((keyword) => q.includes(keyword) || keyword.includes(q)),
  ).slice(0, 4);
}

export function isAskStyleQuery(query: string): boolean {
  const q = normalize(query);
  if (!q) return false;
  if (q.endsWith("?")) return true;
  return /^(what|which|who|when|how|show|list|find|tell)\b/.test(q);
}

export function answerSmartSearchQuestion(
  query: string,
  ctx: SmartSearchContext,
): AskSearchResult | null {
  const q = normalize(query);
  if (!q) return null;

  if (
    q.includes("what changed this week") ||
    q.includes("executive brief") ||
    q.includes("weekly summary") ||
    q.includes("what changed")
  ) {
    return buildWeeklyBriefingAnswer(ctx);
  }

  if (
    q.includes("opportunit") &&
    (q.includes("attention") || q.includes("need") || q.includes("risk") || q.includes("at risk"))
  ) {
    return buildOpportunitiesNeedingAttentionAnswer(ctx);
  }

  if (
    q.includes("compan") &&
    (q.includes("no recent") || q.includes("no activity") || q.includes("cold") || q.includes("inactive"))
  ) {
    return buildCompaniesNoActivityAnswer(ctx);
  }

  if (
    q.includes("quotation") ||
    q.includes("awaiting response") ||
    q.includes("awaiting") ||
    q.includes("sent quotation")
  ) {
    return buildQuotationsAwaitingAnswer(ctx);
  }

  if (q.includes("close this month") || q.includes("closing this month")) {
    return buildClosingThisMonthAnswer(ctx);
  }

  if (
    q.includes("highest pipeline") ||
    q.includes("top pipeline") ||
    q.includes("largest pipeline") ||
    q.includes("highest value")
  ) {
    return buildHighestPipelineAnswer(ctx);
  }

  if (q.includes("sales review") || q.includes("pipeline review")) {
    return buildSalesReviewAnswer(ctx);
  }

  if (q.includes("commercial review")) {
    return buildCommercialReviewAnswer(ctx);
  }

  if (isStrategicCustomersQuery(q)) {
    return buildStrategicCustomersAnswer(ctx);
  }

  const companyType = matchCompanyTypeQuery(q);
  if (companyType) {
    return buildCompaniesByTypeAnswer(ctx, companyType);
  }

  return buildFallbackAnswer(q, ctx);
}

function buildWeeklyBriefingAnswer(ctx: SmartSearchContext): AskSearchResult {
  const briefing = buildDailyBriefing(ctx.companies, ctx.pipelines, ctx.activities);
  const attentionItems = buildAttentionItems({
    companies: ctx.companies,
    pipelines: ctx.pipelines,
    activities: ctx.activities,
    commercialPackages: ctx.commercialPackages,
  }).slice(0, 8);

  const items: SearchIndexItem[] = [
    ...briefing.opportunitiesAtRisk.map((item) =>
      indexItemToResult({
        id: `ask-${item.id}`,
        entityType: "deal",
        name: item.label,
        typeLabel: "At Risk",
        contextPreview: item.detail,
        lastActivityLabel: "Portfolio intelligence",
        lastActivityAt: "",
        href: item.href ?? "/opportunities?filter=needs_attention",
        searchText: item.label.toLowerCase(),
      }),
    ),
    ...attentionItems.slice(0, 4).map((item) =>
      indexItemToResult({
        id: `ask-${item.id}`,
        entityType: "attention",
        name: item.sourceObjectName,
        typeLabel: item.objectType,
        contextPreview: item.recommendation,
        lastActivityLabel: item.suggestedAiAction,
        lastActivityAt: item.dueDate ?? "",
        href: item.href,
        searchText: item.sourceObjectName.toLowerCase(),
        attentionItemId: item.id,
        actions: resolveAttentionActions(item),
      }),
    ),
  ];

  const wonCount = ctx.pipelines.filter((deal) => deal.status === "Live Production").length;

  return {
    answer: `${briefing.headline} ${wonCount} opportunit${wonCount === 1 ? "y" : "ies"} in live production. ${briefing.opportunitiesAtRisk.length} at risk, ${attentionItems.length} open attention signals, and ${briefing.recommendedFocus.length} recommended focus actions.`,
    recommendedAction: briefing.recommendedFocus[0]?.action ?? "Review portfolio attention queue",
    actionHref: briefing.recommendedFocus[0]?.href ?? "/",
    items,
  };
}

function buildOpportunitiesNeedingAttentionAnswer(ctx: SmartSearchContext): AskSearchResult {
  const workspace = buildOpportunityOperationsWorkspace(
    ctx.pipelines,
    ctx.companies,
    ctx.activities,
    ctx.commercialPackages,
    ctx.user,
  );
  const rows = sortOpportunityOperationsRows(
    filterOpportunityOperationsRows(workspace.rows, "needs_attention", ctx.user),
  ).slice(0, 8);

  const items = rows.map((row) =>
    indexItemToResult({
      id: `ask-${row.dealId}`,
      entityType: "deal",
      name: row.dealName,
      typeLabel: row.stageLabel,
      contextPreview: `${row.companyName ?? "—"} · ${row.attentionLabel}`,
      lastActivityLabel: row.closeDateLabel,
      lastActivityAt: row.expectedCloseDate ?? "",
      href: row.dealHref,
      searchText: row.dealName.toLowerCase(),
    }),
  );

  return {
    answer: `${rows.length} opportunit${rows.length === 1 ? "y needs" : "ies need"} attention across the portfolio.`,
    recommendedAction: rows[0]?.attentionLabel ?? "Review opportunities workspace",
    actionHref: rows[0]?.dealHref ?? "/opportunities?filter=needs_attention",
    items,
  };
}

function buildCompaniesNoActivityAnswer(ctx: SmartSearchContext): AskSearchResult {
  const workspace = buildCompanyOperationsWorkspace(
    ctx.companies,
    ctx.pipelines,
    ctx.activities,
    ctx.commercialPackages,
    ctx.user,
  );
  const rows = workspace.rows.filter((row) => row.isColdContact).slice(0, 8);

  const items = rows.map((row) =>
    indexItemToResult({
      id: `ask-${row.companyId}`,
      entityType: "company",
      name: row.companyName,
      typeLabel: row.healthStatus,
      contextPreview: `${row.locationLabel} · Last contact ${row.lastContactLabel}`,
      lastActivityLabel: row.attentionLabel,
      lastActivityAt: "",
      href: row.companyHref,
      searchText: row.companyName.toLowerCase(),
      smartMeta: {
        locationLabel: row.locationLabel,
        openOpportunities: row.openOpportunities,
        pipelineValueLabel: row.pipelineValueLabel,
        attentionCount: row.needsAttention ? 1 : 0,
        companyId: row.companyId,
        companyName: row.companyName,
      },
    }),
  );

  return {
    answer: `${rows.length} compan${rows.length === 1 ? "y has" : "ies have"} no recent activity (45+ days since last contact).`,
    recommendedAction: "Schedule follow-up calls for cooling accounts",
    actionHref: "/companies?filter=no_recent_activity",
    items,
  };
}

function buildQuotationsAwaitingAnswer(ctx: SmartSearchContext): AskSearchResult {
  const awaiting = ctx.commercialPackages.filter(
    (pkg) => isQuotationKind(pkg.kind) && pkg.status === "sent",
  );

  const items = awaiting.slice(0, 8).map((pkg) =>
    indexItemToResult({
      id: `ask-${pkg.PackageID}`,
      entityType: "transmission",
      name: pkg.title || pkg.DocumentSetID,
      typeLabel: COMMERCIAL_PACKAGE_KIND_LABELS[pkg.kind],
      contextPreview: `${pkg.DealId} · ${pkg.recipient ?? "Recipient pending"} · Awaiting response`,
      lastActivityLabel: pkg.sentAt ? `Sent ${pkg.sentAt}` : "Sent",
      lastActivityAt: pkg.sentAt ?? pkg.CreatedAt ?? "",
      href: deal360Href(pkg.DealId, "commercial", { packageId: pkg.PackageID }),
      searchText: `${pkg.title} ${pkg.DocumentSetID}`.toLowerCase(),
    }),
  );

  return {
    answer: `${awaiting.length} quotation${awaiting.length === 1 ? "" : "s"} sent and awaiting customer response.`,
    recommendedAction: "Follow up on outstanding quotations",
    actionHref: awaiting[0] ? deal360Href(awaiting[0].DealId, "commercial") : "/opportunities",
    items,
  };
}

function buildClosingThisMonthAnswer(ctx: SmartSearchContext): AskSearchResult {
  const workspace = buildOpportunityOperationsWorkspace(
    ctx.pipelines,
    ctx.companies,
    ctx.activities,
    ctx.commercialPackages,
    ctx.user,
  );
  const rows = workspace.rows.filter((row) => row.isClosingThisMonth).slice(0, 8);

  const items = rows.map((row) =>
    indexItemToResult({
      id: `ask-${row.dealId}`,
      entityType: "deal",
      name: row.dealName,
      typeLabel: "Closing this month",
      contextPreview: `${row.companyName ?? "—"} · ${row.valueLabel}`,
      lastActivityLabel: row.closeDateLabel,
      lastActivityAt: row.expectedCloseDate ?? "",
      href: row.dealHref,
      searchText: row.dealName.toLowerCase(),
    }),
  );

  return {
    answer: `${rows.length} opportunit${rows.length === 1 ? "y closes" : "ies close"} this month.`,
    recommendedAction: "Confirm close plans and commercial readiness",
    actionHref: "/opportunities?filter=closing_soon",
    items,
  };
}

function buildHighestPipelineAnswer(ctx: SmartSearchContext): AskSearchResult {
  const byCompany = new Map<string, { company: Company; value: number; deals: number }>();

  for (const company of ctx.companies) {
    const deals = company.pipelineIds
      .map((id) => ctx.pipelines.find((deal) => deal.id === id))
      .filter(
        (deal) =>
          deal && deal.status !== "Live Production" && deal.status !== "Scheduled Maintenance",
      );
    const value = deals.reduce((sum, deal) => sum + (deal?.salesValue ?? 0), 0);
    if (value > 0) byCompany.set(company.CompanyID, { company, value, deals: deals.length });
  }

  const ranked = [...byCompany.values()]
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const dominantCurrency = ctx.pipelines.find((deal) => deal.currency)?.currency ?? "EUR";

  const items = ranked.map((entry) =>
    indexItemToResult({
      id: `ask-${entry.company.CompanyID}`,
      entityType: "company",
      name: entry.company.Title,
      typeLabel: `${entry.deals} opportunities`,
      contextPreview: formatDealValue(dominantCurrency, entry.value),
      lastActivityLabel: "Pipeline value",
      lastActivityAt: "",
      href: company360Href(entry.company.CompanyID, "opportunities"),
      searchText: entry.company.Title.toLowerCase(),
      smartMeta: {
        companyId: entry.company.CompanyID,
        companyName: entry.company.Title,
        openOpportunities: entry.deals,
        pipelineValueLabel: formatDealValue(dominantCurrency, entry.value),
      },
    }),
  );

  return {
    answer: `Top accounts by open pipeline value: ${ranked
      .slice(0, 3)
      .map((entry) => entry.company.Title)
      .join(", ")}.`,
    recommendedAction: "Review strategic accounts with highest revenue potential",
    actionHref: ranked[0] ? company360Href(ranked[0].company.CompanyID, "opportunities") : "/companies",
    items,
  };
}

function buildSalesReviewAnswer(ctx: SmartSearchContext): AskSearchResult {
  const workspace = buildOpportunityOperationsWorkspace(
    ctx.pipelines,
    ctx.companies,
    ctx.activities,
    ctx.commercialPackages,
    ctx.user,
  );

  return {
    answer: `Portfolio understanding: ${workspace.understanding.requiresAttentionCount} opportunit${workspace.understanding.requiresAttentionCount === 1 ? "y" : "ies"} require attention with ${workspace.understanding.validationGapsCount} validation gap${workspace.understanding.validationGapsCount === 1 ? "" : "s"}. ${workspace.understanding.subline}`,
    recommendedAction: workspace.understanding.primaryFocus
      ? `Review ${workspace.understanding.primaryFocus.dealName}`
      : "Open opportunities for portfolio understanding",
    actionHref: workspace.understanding.primaryFocus?.dealHref ?? "/opportunities",
    items: sortOpportunityOperationsRows(workspace.rows).slice(0, 6).map((row) =>
      indexItemToResult({
        id: `ask-${row.dealId}`,
        entityType: "deal",
        name: row.dealName,
        typeLabel: row.recommendedAttention,
        contextPreview: `${row.clientObjective} · ${row.biggestUnknown}`,
        lastActivityLabel: row.nextStep,
        lastActivityAt: row.expectedCloseDate ?? "",
        href: row.dealHref,
        searchText: row.dealName.toLowerCase(),
      }),
    ),
  };
}

function buildCommercialReviewAnswer(ctx: SmartSearchContext): AskSearchResult {
  const sent = ctx.commercialPackages.filter((pkg) => pkg.status === "sent").length;
  const baselines = ctx.commercialPackages.filter((pkg) => pkg.kind === "commercial_baseline").length;
  const transmissions = ctx.commercialPackages.filter((pkg) => pkg.kind === "transmission").length;

  const items = ctx.commercialPackages
    .filter((pkg) => pkg.status === "sent" || pkg.kind === "transmission")
    .slice(0, 6)
    .map((pkg) =>
      indexItemToResult({
        id: `ask-${pkg.PackageID}`,
        entityType: pkg.kind === "transmission" ? "transmission" : "document_set",
        name: pkg.title || pkg.DocumentSetID,
        typeLabel: COMMERCIAL_PACKAGE_KIND_LABELS[pkg.kind],
        contextPreview: `${pkg.DealId} · ${pkg.status}`,
        lastActivityLabel: pkg.sentAt ?? pkg.CreatedAt ?? "—",
        lastActivityAt: pkg.sentAt ?? pkg.CreatedAt ?? "",
        href: deal360Href(pkg.DealId, "commercial", { packageId: pkg.PackageID }),
        searchText: pkg.title.toLowerCase(),
      }),
    );

  return {
    answer: `Commercial review: ${sent} quotations awaiting response, ${transmissions} transmission packages, ${baselines} commercial baselines established.`,
    recommendedAction: "Advance quotations and close commercial gaps",
    actionHref: "/intelligence",
    items,
  };
}

function buildCompaniesByTypeAnswer(
  ctx: SmartSearchContext,
  type: import("@/types/company-type").CompanyType,
): AskSearchResult {
  const matches = filterCompaniesByType(ctx.companies, type);
  const items = matches.slice(0, 8).map((company) => {
    const types = normalizeCompanyTypes(company);
    return indexItemToResult({
      id: `ask-company-${company.CompanyID}`,
      entityType: "company",
      name: company.Title,
      typeLabel: types.join(" · "),
      contextPreview: `${company.Status} · ${company.Industry}`,
      lastActivityLabel: "Company classification",
      lastActivityAt: "",
      href: company360Href(company.CompanyID),
      searchText: company.Title.toLowerCase(),
    });
  });

  const plural = type === "Customer" ? "customers" : `${type.toLowerCase()}s`;

  return {
    answer: `${matches.length} ${plural} in SmartCRM.`,
    recommendedAction: `Review ${plural}`,
    actionHref: `/companies?type=${encodeURIComponent(type)}`,
    items,
  };
}

function buildStrategicCustomersAnswer(ctx: SmartSearchContext): AskSearchResult {
  const summaries = buildCompanySummariesForCompanies(
    ctx.companies,
    ctx.activities,
    ctx.pipelines,
  );

  const strategic = summaries.filter((summary) =>
    isStrategicCustomer(summary.company, summary.healthStatus, summary.healthScore),
  );

  const items = strategic.slice(0, 8).map((summary) =>
    indexItemToResult({
      id: `ask-strategic-${summary.company.CompanyID}`,
      entityType: "company",
      name: summary.company.Title,
      typeLabel: "Strategic Customer",
      contextPreview: `Health ${summary.healthScore}/100 · ${summary.activeDeals} open opportunities`,
      lastActivityLabel: summary.lastContactLabel,
      lastActivityAt: summary.lastContactAt ?? "",
      href: company360Href(summary.company.CompanyID),
      searchText: summary.company.Title.toLowerCase(),
    }),
  );

  return {
    answer: `${strategic.length} strategic customer${strategic.length === 1 ? "" : "s"} with strong relationship health and active pipeline.`,
    recommendedAction: "Review strategic customer portfolio",
    actionHref: "/companies?filter=strategic_accounts",
    items,
  };
}

function buildFallbackAnswer(query: string, ctx: SmartSearchContext): AskSearchResult {
  const tokens = query.split(/\s+/).filter((token) => token.length > 2);
  const matches = ctx.index
    .filter((item) => tokens.some((token) => item.searchText.includes(token)))
    .slice(0, 8);

  if (matches.length === 0) {
    return {
      answer: `I couldn't find a precise answer for "${query}". Try one of the suggested questions or switch to Search mode.`,
      recommendedAction: "Browse suggested questions",
      items: [],
    };
  }

  return {
    answer: `Found ${matches.length} related record${matches.length === 1 ? "" : "s"} that may answer your question.`,
    recommendedAction: matches[0]?.name ?? "Open top result",
    actionHref: matches[0]?.href,
    items: matches,
  };
}

export function getSuggestedAskQuestions(): readonly string[] {
  return ASK_SUGGESTED_QUESTIONS;
}

export function recentActivityScore(item: SearchIndexItem): number {
  if (!item.lastActivityAt) return 0;
  const days = daysBetween(item.lastActivityAt);
  return Math.max(0, 90 - days);
}
