import growthSeed from "@/data/growth-intelligence.json";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import { companyHasType, normalizeCompanyTypes } from "@/lib/company-classification";
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
} from "@/types/growth-intelligence";
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

export function buildGrowthIntelligence(
  companies: Company[],
  pipelines: PipelineRow[],
): GrowthIntelligenceSnapshot {
  const seed = growthSeed as unknown as GrowthSeed;
  const competitors = buildCompetitorProfiles(companies);
  const competitiveLandscape = buildCompetitiveLandscape(companies, pipelines);
  const events = seed.events;
  const recommendations = seed.recommendations;
  const eventsRequiringPlanning = events.filter((e) => e.planningStatus === "needs_planning");
  const highPriorityRecommendations = recommendations.filter(
    (r) => r.priority === "critical" || r.priority === "high",
  );
  const partnerEcosystem = buildPartnerEcosystem(companies);
  const emergingOpportunities = buildEmergingOpportunities(pipelines, seed.marketSegments);

  const attention = buildAttention(competitors, events, recommendations);

  return {
    generatedAt: new Date().toISOString(),
    attention,
    emergingOpportunities,
    activeCompetitors: competitors.filter(
      (c) => c.threatLevel === "critical" || c.threatLevel === "high",
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
    marketIntelligence: seed.marketIntelligence,
    competitiveLandscape,
    metrics: {
      competitorCount: competitors.length,
      eventsNeedingPlanning: eventsRequiringPlanning.length,
      highPriorityRecommendations: highPriorityRecommendations.length,
      partnerCount: partnerEcosystem.length,
      emergingOpportunityCount: emergingOpportunities.length,
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
