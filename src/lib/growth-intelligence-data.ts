import growthSeed from "@/data/growth-intelligence.json";
import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import { companyHasType, normalizeCompanyTypes } from "@/lib/company-classification";
import { isEventPast, isEventUpcoming } from "@/lib/growth-event-timing";
import {
  buildGrowthOperatingLoop,
  companyForDeal,
  openSalesDeals,
} from "@/lib/growth-operating-loop";
import { buildGrowthSuperSkills, offerLabel } from "@/lib/growth-super-skills";
import { buildAllCompetitorProfiles, buildCompetitiveLandscape } from "@/lib/growth-competitive-intelligence-engine";
import { company360Href } from "@/types/company-360";
import type {
  GrowthCompetitorProfile,
  GrowthEvent,
  GrowthIntelligenceSnapshot,
  GrowthMarketIntelligenceItem,
  GrowthMarketSegment,
  GrowthMarketingChannel,
  GrowthMembership,
  GrowthRecommendation,
  GrowthStrategicInitiative,
  GrowthLiveDeal,
} from "@/types/growth-intelligence";
import type {
  GrowthCorrespondenceSnippet,
  GrowthDealRecord,
} from "@/types/growth-super-skills";
import { GROWTH_ECOSYSTEM_TYPES } from "@/types/company-type";
import type { CompanyType } from "@/types/company-type";

type GrowthSeed = {
  competitorProfiles: Record<
    string,
    Omit<GrowthCompetitorProfile, "companyId" | "companyName" | "href">
  >;
  events: GrowthEvent[];
  memberships: GrowthMembership[];
  marketSegments: GrowthMarketSegment[];
  marketingChannels: GrowthMarketingChannel[];
  recommendations: GrowthRecommendation[];
  strategicInitiatives: GrowthStrategicInitiative[];
  marketIntelligence: GrowthMarketIntelligenceItem[];
};

const PARTNER_TYPES: CompanyType[] = [
  "Partner",
  "Offtaker",
  "Investor",
  "University / Research",
  "Research Organization",
  "NGO / Non-Profit",
  "Association",
];

function buildCompetitorProfiles(companies: Company[]): GrowthCompetitorProfile[] {
  return buildAllCompetitorProfiles(companies);
}

function buildPartnerEcosystem(companies: Company[]) {
  return companies
    .filter((company) => {
      const types = normalizeCompanyTypes(company);
      return types.some((type) => PARTNER_TYPES.includes(type));
    })
    .map((company) => {
      const types = normalizeCompanyTypes(company).filter((type) =>
        PARTNER_TYPES.includes(type),
      );
      const primary = types[0] ?? "Partner";
      return {
        companyId: company.CompanyID,
        companyName: company.Title,
        types,
        role: primary,
        strategicValue:
          primary === "Offtaker"
            ? "Connects customer projects to offtake pathways"
            : primary === "Investor"
              ? "Project finance introductions for machinery CAPEX"
              : primary === "University / Research" || primary === "Research Organization"
                ? "Technical credibility and joint feasibility studies"
                : primary === "NGO / Non-Profit" || primary === "Association"
                  ? "Industry influence and ecosystem access"
                  : "Implementation and referral partnerships",
        href: company360Href(company.CompanyID),
      };
    });
}

function buildAttention(
  competitors: GrowthCompetitorProfile[],
  events: GrowthIntelligenceSnapshot["events"],
  recommendations: GrowthRecommendation[],
): GrowthIntelligenceSnapshot["attention"] {
  const items: GrowthIntelligenceSnapshot["attention"] = [];

  const criticalCompetitor = competitors.find((c) => c.threatLevel === "critical");
  if (criticalCompetitor) {
    items.push({
      id: "attn-competitor",
      label: `${criticalCompetitor.companyName} active in EU market`,
      detail: criticalCompetitor.recentActivity,
      severity: "critical",
      href: `/growth/competitors/${criticalCompetitor.companyId}`,
      impact: [
        "Competitor certification narrative affects customer bankability conversations",
        "Counter-position on machinery reliability and paid engineering rigor",
      ],
    });
  }

  const planningEvents = events.filter((e) => e.planningStatus === "needs_planning");
  if (planningEvents.length > 0) {
    items.push({
      id: "attn-events",
      label: `${planningEvents.length} event${planningEvents.length === 1 ? "" : "s"} require planning`,
      detail: planningEvents.map((e) => e.name).join(" · "),
      severity: "warning",
      href: "/growth/events",
      impact: [
        "IFAT and ECOMONDO are highest-value EU pipeline events",
        "Meeting-led attendance outperforms booth-only presence",
      ],
    });
  }

  const criticalRec = recommendations.find((r) => r.priority === "critical");
  if (criticalRec) {
    items.push({
      id: "attn-rec",
      label: criticalRec.what,
      detail: criticalRec.why,
      severity: "warning",
      href: "/growth/recommendations",
      impact: [criticalRec.expectedOutcome],
    });
  }

  items.push({
    id: "attn-feasibility",
    label: "Paid feasibility product not yet launched",
    detail: "Free scoping signals low value for engineering expertise.",
    severity: "info",
    href: "/growth/recommendations",
    impact: [
      "Converts pre-sales into paid consulting revenue",
      "Filters serious machinery buyers from price shoppers",
    ],
  });

  return items;
}

function buildEmergingOpportunities(
  pipelines: PipelineRow[],
  segments: GrowthIntelligenceSnapshot["marketSegments"],
): GrowthIntelligenceSnapshot["emergingOpportunities"] {
  const prospects = pipelines
    .filter((p) => p.status === "Prospecting" || p.status === "Feedstock Analysis")
    .slice(0, 3);

  const fromPipeline = prospects.map((deal) => ({
    id: `opp-${deal.id}`,
    label: deal.assetName ?? deal.id,
    segment: "Active pipeline",
    horizon: "90d" as const,
    potential: "high" as const,
    impact: [
      "Existing CRM opportunity — align growth actions to deal stage",
      "Paid feasibility may accelerate machinery decision",
    ],
    href: `/deals/${encodeURIComponent(deal.id)}`,
  }));

  const fromSegments = segments
    .filter((s) => s.trend === "growing" || s.trend === "emerging")
    .slice(0, 2)
    .map((segment) => ({
      id: `seg-opp-${segment.id}`,
      label: segment.name,
      segment: segment.geography,
      horizon: "12m" as const,
      potential: segment.machineryPotential === "high" ? ("high" as const) : ("medium" as const),
      impact: segment.impact,
    }));

  return [...fromPipeline, ...fromSegments];
}

function groundRecommendations(
  recommendations: GrowthRecommendation[],
  companies: Company[],
  pipelines: PipelineRow[],
  events: GrowthEvent[],
): GrowthRecommendation[] {
  const liveNames = openSalesDeals(pipelines)
    .slice(0, 3)
    .map((deal) => {
      const company = companyForDeal(companies, deal);
      return company ? `${deal.assetName} (${company.Title})` : deal.assetName;
    });

  return recommendations
    .filter((rec) => {
      const ifat = events.find((event) => /ifat/i.test(event.name));
      if (ifat && isEventPast(ifat) && /ifat 2026/i.test(rec.what)) return false;
      return true;
    })
    .map((rec) => {
      if (rec.id === "rec-feasibility-product" && liveNames.length > 0) {
        return {
          ...rec,
          where: liveNames.join("; "),
          why: `${rec.why} Live deals in the registry: ${liveNames.join("; ")}.`,
        };
      }
      return rec;
    });
}

function buildLiveDeals(
  companies: Company[],
  pipelines: PipelineRow[],
  offers: ReturnType<typeof buildGrowthSuperSkills>["offers"],
): GrowthLiveDeal[] {
  return openSalesDeals(pipelines).map((deal) => {
    const company = companyForDeal(companies, deal);
    const choice = offers.find((row) => row.dealId === deal.id);
    return {
      id: deal.id,
      name: deal.assetName,
      companyName: company?.Title ?? deal.ClientLookup?.trim() ?? "Unlinked company",
      status: deal.status,
      nextStep: deal.currentMilestone?.trim() || "Not captured",
      href: `/deals/${encodeURIComponent(deal.id)}`,
      offer: choice ? offerLabel(choice.offer) : undefined,
      offerWhy: choice?.why,
    };
  });
}

const LIVE_INTEL_CATEGORY: Record<
  string,
  GrowthMarketIntelligenceItem["category"]
> = {
  demand: "trend",
  pipeline: "funding",
  unknown: "research",
  regulation: "regulation",
  funding: "funding",
  competitor_activity: "competitor_activity",
};

export type GrowthIntelligenceExtras = {
  activities?: Activity[];
  growthDeals?: GrowthDealRecord[];
  correspondence?: GrowthCorrespondenceSnippet[];
};

export function buildGrowthIntelligence(
  companies: Company[],
  pipelines: PipelineRow[],
  extras: GrowthIntelligenceExtras = {},
): GrowthIntelligenceSnapshot {
  const seed = growthSeed as unknown as GrowthSeed;
  const competitors = buildCompetitorProfiles(companies);
  const competitiveLandscape = buildCompetitiveLandscape(companies, pipelines);
  const events = seed.events.map((event) =>
    isEventPast(event)
      ? { ...event, planningStatus: "completed" as const }
      : event,
  );
  const dealSource = extras.growthDeals?.length ? extras.growthDeals : pipelines;
  const superSkills = buildGrowthSuperSkills({
    companies,
    pipelines: dealSource,
    events,
    activities: extras.activities,
    growthDeals: extras.growthDeals,
    correspondence: extras.correspondence,
  });
  const recommendations = groundRecommendations(
    seed.recommendations,
    companies,
    pipelines,
    events,
  );
  const eventsRequiringPlanning = events.filter(
    (event) =>
      isEventUpcoming(event) &&
      event.planningStatus === "needs_planning" &&
      event.recommendation === "attend",
  );
  const highPriorityRecommendations = recommendations.filter(
    (rec) => rec.priority === "critical" || rec.priority === "high",
  );
  const partnerEcosystem = buildPartnerEcosystem(companies);
  const emergingOpportunities = buildEmergingOpportunities(pipelines, seed.marketSegments);
  const operatingLoop = buildGrowthOperatingLoop(
    companies,
    dealSource,
    events,
    new Date(),
    superSkills,
  );
  const liveDeals = buildLiveDeals(companies, dealSource, superSkills.offers);
  const attention = buildAttention(competitors, eventsRequiringPlanning, recommendations);
  const liveMarketIntelligence: GrowthMarketIntelligenceItem[] = superSkills.marketIntel.map(
    (card) => ({
      id: card.id,
      category: LIVE_INTEL_CATEGORY[card.category] ?? "research",
      title: card.title,
      summary: card.fact,
      dateLabel: card.asOf,
      relevance: card.evidence === "observed" ? "high" : "low",
      impact: [card.offerWhy, card.nextAction],
      evidence: card.evidence === "observed" ? "observed" : "hypothesis",
    }),
  );
  const unverifiedMarketNotes = seed.marketIntelligence.map((item) => ({
    ...item,
    evidence: item.evidence ?? ("hypothesis" as const),
  }));

  if (unverifiedMarketNotes.length > 0) {
    operatingLoop.watch = operatingLoop.watch.slice(0, 4);
    if (!operatingLoop.watch.some((item) => item.id === "unsourced-intel")) {
      operatingLoop.watch.push({
        id: "unsourced-intel",
        horizon: "watch",
        title: "Unsourced market notes are not intelligence",
        why: `${unverifiedMarketNotes.length} JSON cards have no source or date. They stay collapsed until evidenced.`,
        next: "Open Market Intelligence for the live evidence librarian — ignore strategy notes in primary briefings.",
        impact: "Stops landfill-directive essays from driving this week’s work.",
        href: "/growth/market-intelligence",
        evidence: "hypothesis",
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    operatingLoop,
    liveDeals,
    attention,
    emergingOpportunities,
    activeCompetitors: competitors.filter(
      (competitor) => competitor.threatLevel === "critical" || competitor.threatLevel === "high",
    ),
    eventsRequiringPlanning,
    recommendations,
    competitors,
    events,
    memberships: seed.memberships,
    marketSegments: seed.marketSegments,
    marketingChannels: seed.marketingChannels,
    partnerEcosystem,
    strategicInitiatives: seed.strategicInitiatives,
    marketIntelligence: liveMarketIntelligence,
    unverifiedMarketNotes,
    superSkills,
    competitiveLandscape,
    metrics: {
      competitorCount: competitors.length,
      eventsNeedingPlanning: eventsRequiringPlanning.length,
      highPriorityRecommendations: highPriorityRecommendations.length,
      partnerCount: partnerEcosystem.length,
      emergingOpportunityCount: liveDeals.length,
    },
  };
}

export function growthCompaniesByEcosystemType(
  companies: Company[],
  type: CompanyType,
): Company[] {
  if (!GROWTH_ECOSYSTEM_TYPES.includes(type)) {
    return companies.filter((c) => companyHasType(c, type));
  }
  return companies.filter((c) => companyHasType(c, type));
}
