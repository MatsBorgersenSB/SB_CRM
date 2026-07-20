import growthSeed from "@/data/growth-intelligence.json";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type { GrowthCompetitorProfile, GrowthEvent, GrowthMarketIntelligenceItem } from "@/types/growth-intelligence";
import { company360Href } from "@/types/company-360";
import { companyHasType } from "@/lib/company-classification";
import type { ConfidenceLevel } from "@/lib/opportunity-workspace-intelligence";
import type {
  CompetitiveBusinessContext,
  CompetitiveLandscapeContext,
  CompetitiveLandscapeSummary,
  CompetitiveMarketContext,
  CompetitiveTechnologyContext,
  CompetitorBdDecision,
  CompetitorChangeSignal,
  CompetitorUnderstanding,
  PotentialMissingCompetitor,
} from "@/types/competitive-intelligence";
import { SMARTASSIST_COMPETITIVE_QUESTIONS } from "@/types/competitive-intelligence";
import type { SmartAssistInsight } from "@/types/smartassist-intelligence";
import {
  applySignalBudget,
  buildSignalConfidence,
  scoreCompetitorOverlap,
  SIGNAL_BUDGETS,
} from "@/lib/signal-extraction";

type CompetitorProfileSeed = Omit<GrowthCompetitorProfile, "companyId" | "companyName" | "href"> & {
  companyName: string;
  whyWeCompete?: string;
  whereWeCompete?: {
    markets: string[];
    geographies: string[];
    segments: string[];
  };
  howWeCompete?: {
    theirApproach: string;
    ourCounter: string;
    winConditions: string[];
    loseConditions: string[];
  };
  whatsChanging?: CompetitorChangeSignal[];
};

type CompetitiveContextSeed = {
  business: { summary: string; focusAreas: string[] };
  markets: CompetitiveMarketContext[];
  technologies: CompetitiveTechnologyContext[];
};

type GrowthSeedExtended = {
  competitiveContext: CompetitiveContextSeed;
  competitorProfiles: Record<string, CompetitorProfileSeed>;
  potentialMissingCompetitors?: PotentialMissingCompetitor[];
  events: GrowthEvent[];
  marketIntelligence: GrowthMarketIntelligenceItem[];
};

const seed = growthSeed as unknown as GrowthSeedExtended;

function buildProfileFromSeed(companyId: string, profileSeed: CompetitorProfileSeed, company?: Company): GrowthCompetitorProfile {
  return {
    companyId,
    companyName: company?.Title ?? profileSeed.companyName,
    threatLevel: profileSeed.threatLevel,
    competitorClass: profileSeed.competitorClass,
    positioning: profileSeed.positioning,
    strengths: profileSeed.strengths,
    weaknesses: profileSeed.weaknesses,
    successFactors: profileSeed.successFactors,
    recentActivity: profileSeed.recentActivity,
    memberships: profileSeed.memberships,
    certifications: profileSeed.certifications,
    eventPresence: profileSeed.eventPresence,
    learnings: profileSeed.learnings,
    href: company ? company360Href(company.CompanyID) : `/growth/competitors/${companyId}`,
  };
}

export function listCompetitorIds(): string[] {
  return Object.keys(seed.competitorProfiles);
}

export function getCompetitorProfile(companyId: string): GrowthCompetitorProfile | null {
  const profileSeed = seed.competitorProfiles[companyId];
  if (!profileSeed) return null;
  return buildProfileFromSeed(companyId, profileSeed);
}

export function buildAllCompetitorProfiles(companies: Company[]): GrowthCompetitorProfile[] {
  const crmCompetitors = companies.filter((company) => companyHasType(company, "Competitor"));
  const crmIds = new Set(crmCompetitors.map((c) => c.CompanyID));

  const fromCrm = crmCompetitors.map((company) => {
    const profileSeed = seed.competitorProfiles[company.CompanyID];
    if (profileSeed) {
      return buildProfileFromSeed(company.CompanyID, profileSeed, company);
    }
    return {
      companyId: company.CompanyID,
      companyName: company.Title,
      threatLevel: "medium" as const,
      competitorClass: "direct" as const,
      positioning: `${company.Industry} technology supplier`,
      strengths: [],
      weaknesses: [],
      successFactors: [],
      recentActivity: "No recent activity logged.",
      memberships: [],
      certifications: [],
      eventPresence: [],
      learnings: "Monitor competitive positioning.",
      href: company360Href(company.CompanyID),
    } satisfies GrowthCompetitorProfile;
  });

  const fromSeed = Object.entries(seed.competitorProfiles)
    .filter(([companyId]) => !crmIds.has(companyId))
    .map(([companyId, profileSeed]) => buildProfileFromSeed(companyId, profileSeed));

  return [...fromCrm, ...fromSeed].sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    return order[a.threatLevel] - order[b.threatLevel];
  });
}

function deriveBusinessContext(companies: Company[], pipelines: PipelineRow[]): CompetitiveBusinessContext {
  const industries = [...new Set(companies.map((c) => c.Industry))];
  const activeDeals = pipelines.filter((p) => p.status !== "Won").length;
  const seedBusiness = seed.competitiveContext.business;

  if (industries.length === 0 && activeDeals === 0) {
    return { ...seedBusiness, derivedFrom: "seed" };
  }

  const crmSummary =
    industries.length > 0
      ? `Active CRM focus: ${industries.slice(0, 3).join(", ")}${industries.length > 3 ? " and more" : ""}. ${activeDeals} open opportunities.`
      : `${activeDeals} open opportunities in pipeline.`;

  return {
    summary: `${seedBusiness.summary} ${crmSummary}`,
    focusAreas: seedBusiness.focusAreas,
    derivedFrom: "mixed",
  };
}

function enrichMarketsWithCompetitors(
  markets: CompetitiveMarketContext[],
  competitors: GrowthCompetitorProfile[],
): CompetitiveMarketContext[] {
  return markets.map((market) => {
    const activeCompetitorIds = competitors
      .filter((competitor) => {
        const profileSeed = seed.competitorProfiles[competitor.companyId];
        const where = profileSeed?.whereWeCompete?.markets ?? [];
        return where.some((m) => m.toLowerCase().includes(market.name.toLowerCase().slice(0, 12)));
      })
      .map((c) => c.companyId);

    return { ...market, activeCompetitorIds };
  });
}

function buildLandscapeContext(companies: Company[], pipelines: PipelineRow[], competitors: GrowthCompetitorProfile[]): CompetitiveLandscapeContext {
  return {
    business: deriveBusinessContext(companies, pipelines),
    markets: enrichMarketsWithCompetitors(seed.competitiveContext.markets, competitors),
    technologies: seed.competitiveContext.technologies.map((tech) => ({
      ...tech,
      leadingCompetitorIds: competitors
        .filter((c) => {
          const profileSeed = seed.competitorProfiles[c.companyId];
          return profileSeed?.positioning.toLowerCase().includes(tech.name.toLowerCase().slice(0, 8));
        })
        .map((c) => c.companyId),
    })),
  };
}

function findOverlappingDeals(competitorName: string, pipelines: PipelineRow[]): string[] {
  return pipelines
    .filter((deal) => {
      const text = `${deal.assetName ?? ""} ${deal.targetFeedstock ?? ""} ${deal.currentMilestone ?? ""}`.toLowerCase();
      const competitorTokens = competitorName.toLowerCase().split(/[\s/]+/);
      return competitorTokens.some((token) => token.length > 3 && text.includes(token));
    })
    .map((deal) => deal.assetName ?? deal.id)
    .slice(0, 3);
}

function findRelatedMarketIntel(competitorName: string): string[] {
  const tokens = competitorName.toLowerCase().split(/[\s/]+/).filter((t) => t.length > 3);
  return seed.marketIntelligence
    .filter(
      (item) =>
        item.category === "competitor_activity" &&
        tokens.some((token) => item.title.toLowerCase().includes(token) || item.summary.toLowerCase().includes(token)),
    )
    .map((item) => item.title)
    .slice(0, 3);
}

function buildNextBestDecision(
  profile: GrowthCompetitorProfile,
  profileSeed: CompetitorProfileSeed,
): CompetitorBdDecision {
  if (profile.threatLevel === "critical") {
    return {
      action: `Counter-position ${profile.companyName} on bankability — not certification brand`,
      why: profileSeed.whyWeCompete ?? profile.learnings,
      expectedImpact: "Protects machinery margin in financier-led conversations",
      confidence: "high",
    };
  }
  if (profile.threatLevel === "high") {
    return {
      action: `Pre-book IFAT meetings before ${profile.companyName} waste-sector outreach`,
      why: profileSeed.learnings,
      expectedImpact: "Meeting-led attendance outperforms booth-only presence",
      confidence: "medium",
    };
  }
  return {
    action: "Decline price-only tenders — lead with paid feasibility",
    why: profileSeed.learnings,
    expectedImpact: "Filters price shoppers; protects engineering services margin",
    confidence: "high",
  };
}

function buildKnowledgeInsights(
  profile: GrowthCompetitorProfile,
  profileSeed: CompetitorProfileSeed,
  company: Company | undefined,
): SmartAssistInsight[] {
  const insights: SmartAssistInsight[] = [];

  if (profileSeed.whereWeCompete?.segments?.length) {
    insights.push({
      id: `${profile.companyId}-targets`,
      topic: "Target customers",
      statement: `${profile.companyName} targets ${profileSeed.whereWeCompete.segments.slice(0, 2).join(" and ")}.`,
      category: company ? "known" : "assumed",
      confidence: company ? "high" : "medium",
      confidenceReason: company ? "CRM competitor record" : "Official website and market intelligence",
    });
  }

  if (profileSeed.howWeCompete?.theirApproach) {
    insights.push({
      id: `${profile.companyId}-approach`,
      topic: "Competitive approach",
      statement: profileSeed.howWeCompete.theirApproach,
      category: "assumed",
      confidence: "medium",
      confidenceReason: "Derived from positioning analysis — validate in active deals.",
    });
  }

  insights.push({
    id: `${profile.companyId}-pipeline`,
    topic: "Current project pipeline",
    statement: "Current project pipeline visibility is limited.",
    category: "unknown",
    confidence: "low",
    confidenceReason: "Requires validation through customer conversations or procurement sources.",
  });

  return applySignalBudget(insights, SIGNAL_BUDGETS.knowledgeKnown + SIGNAL_BUDGETS.knowledgeAssumed);
}

function buildCompetitorSignalAssessment(
  profile: GrowthCompetitorProfile,
  profileSeed: CompetitorProfileSeed,
  company: Company | undefined,
  pipelines: PipelineRow[],
): CompetitorUnderstanding["signalAssessment"] {
  const overlappingDeals = findOverlappingDeals(profile.companyName, pipelines);
  const eventCount = profile.eventPresence.length;
  const overlapScores = scoreCompetitorOverlap({
    hasCrmRecord: Boolean(company),
    hasSeedProfile: true,
    threatLevel: profile.threatLevel,
    marketCount: profileSeed.whereWeCompete?.markets.length ?? 0,
    geographyCount: profileSeed.whereWeCompete?.geographies.length ?? 0,
    eventCount,
    hasProductOverlap: profile.positioning.toLowerCase().includes("pyrolysis"),
    hasServiceOverlap: profile.positioning.toLowerCase().includes("engineering"),
    hasPipelineOverlap: overlappingDeals.length > 0,
  });

  const assessment = buildSignalConfidence(
    overlapScores.validatedCount,
    5,
    profile.threatLevel === "critical" || profile.threatLevel === "high",
  );

  return {
    confidence: assessment.confidence,
    confidenceReason: assessment.confidenceReason,
    overlapScores,
  };
}

export function buildCompetitorUnderstanding(
  companyId: string,
  companies: Company[],
  pipelines: PipelineRow[],
): CompetitorUnderstanding | null {
  const profileSeed = seed.competitorProfiles[companyId];
  if (!profileSeed) return null;

  const company = companies.find((c) => c.CompanyID === companyId);
  const profile = buildProfileFromSeed(companyId, profileSeed, company);

  const overlappingEvents = seed.events
    .filter((event) =>
      event.competitivePresence.some((name) =>
        profile.companyName.toLowerCase().includes(name.toLowerCase().slice(0, 4)),
      ),
    )
    .map((event) => event.name);

  return {
    profile,
    whyWeCompete:
      profileSeed.whyWeCompete ??
      `${profile.companyName} competes in overlapping markets — monitor positioning and counter-narrative.`,
    whereWeCompete: {
      markets: profileSeed.whereWeCompete?.markets ?? [],
      geographies: profileSeed.whereWeCompete?.geographies ?? [],
      segments: profileSeed.whereWeCompete?.segments ?? [],
      overlappingDeals: findOverlappingDeals(profile.companyName, pipelines),
      overlappingEvents,
    },
    howWeCompete: profileSeed.howWeCompete ?? {
      theirApproach: profile.positioning,
      ourCounter: profile.learnings,
      winConditions: profile.weaknesses.map((w) => `Exploit: ${w}`),
      loseConditions: profile.strengths.map((s) => `Avoid when buyer prioritizes: ${s}`),
    },
    whatsChanging: profileSeed.whatsChanging ?? [
      {
        change: profile.recentActivity,
        implication: profile.learnings,
        dateLabel: "Recent",
      },
    ],
    whatWeShouldLearn: profile.learnings,
    nextBestDecision: buildNextBestDecision(profile, profileSeed),
    relatedMarketIntelligence: findRelatedMarketIntel(profile.companyName),
    signalAssessment: buildCompetitorSignalAssessment(profile, profileSeed, company, pipelines),
    knowledgeInsights: buildKnowledgeInsights(profile, profileSeed, company),
  };
}

export function buildCompetitiveLandscape(
  companies: Company[],
  pipelines: PipelineRow[],
): CompetitiveLandscapeSummary {
  const competitorProfiles = buildAllCompetitorProfiles(companies);
  const context = buildLandscapeContext(companies, pipelines, competitorProfiles);

  const allCompetitors = competitorProfiles
    .map((profile) => buildCompetitorUnderstanding(profile.companyId, companies, pipelines))
    .filter((item): item is CompetitorUnderstanding => item !== null)
    .sort((a, b) => b.signalAssessment.overlapScores.overall - a.signalAssessment.overlapScores.overall);

  const competitors = applySignalBudget(allCompetitors, SIGNAL_BUDGETS.competitors);

  const landscapeShifts = applySignalBudget(
    allCompetitors.flatMap((c) => c.whatsChanging),
    SIGNAL_BUDGETS.landscapeShifts,
  );

  const rankedDecisions = allCompetitors
    .filter((c) => c.profile.threatLevel === "critical" || c.profile.threatLevel === "high")
    .map((c) => c.nextBestDecision);

  const primaryAction = rankedDecisions[0] ?? null;
  const nextBestDecisions = applySignalBudget(rankedDecisions, 3);

  const potentialMissingCompetitors = applySignalBudget(
    seed.potentialMissingCompetitors ?? [],
    SIGNAL_BUDGETS.missingCompetitors,
  );

  return {
    headline: "Signals — not a competitor database",
    focusQuestions: SMARTASSIST_COMPETITIVE_QUESTIONS,
    context,
    competitors,
    totalCompetitorsIdentified: allCompetitors.length,
    landscapeShifts,
    primaryAction,
    nextBestDecisions,
    potentialMissingCompetitors,
    metrics: {
      competitorCount: allCompetitors.length,
      criticalThreats: allCompetitors.filter((c) => c.profile.threatLevel === "critical").length,
      activeMarkets: context.markets.filter((m) => m.competitiveIntensity === "high").length,
      recentChanges: landscapeShifts.length,
    },
  };
}
