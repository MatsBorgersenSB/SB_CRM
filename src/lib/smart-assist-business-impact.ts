import type { CoPilotActionProposal } from "@/types/smartassist-copilot";
import type {
  BusinessImpactCategory,
  BusinessImpactPriority,
  BusinessImpactRecommendation,
} from "@/types/smart-assist-business-impact";
import { SMARTASSIST_BUSINESS_IMPACT } from "@/lib/smart-assist-config";

const CATEGORY_RANK: Record<BusinessImpactCategory, number> = {
  opportunity: 100,
  commercial: 95,
  relationship: 90,
  crm_admin: 55,
};

export function categoryFromSource(source: string, headline?: string): BusinessImpactCategory {
  if (source === "Opportunity health" || headline?.toLowerCase().includes("opportunity")) {
    return "opportunity";
  }
  if (source === "Relationship health" || headline?.toLowerCase().includes("relationship")) {
    return "relationship";
  }
  if (
    source === "Attention engine" &&
    (headline?.toLowerCase().includes("quotation") ||
      headline?.toLowerCase().includes("commercial") ||
      headline?.toLowerCase().includes("contract"))
  ) {
    return "commercial";
  }
  if (source === "CRM Co-Pilot") return "crm_admin";
  if (source === "Open commitment") return "relationship";
  return "commercial";
}

export function applyCategoryWeight(
  impactScore: number,
  category: BusinessImpactCategory,
): number {
  return Math.round((impactScore * CATEGORY_RANK[category]) / 100);
}

export function priorityFromScore(score: number): BusinessImpactPriority {
  if (score >= 80) return "Critical";
  if (score >= 60) return "High";
  if (score >= 40) return "Medium";
  return "Low";
}

export function formatBusinessImpactBlock(
  rec: BusinessImpactRecommendation,
  index: number,
): string {
  return [
    `${index}. ${rec.entityName}`,
    "",
    "Situation:",
    "",
    rec.situation,
    "",
    "Impact:",
    "",
    rec.impact,
    "",
    "Recommended Action:",
    "",
    rec.recommendedAction,
    "",
    "Estimated Effort:",
    "",
    rec.estimatedEffort,
    "",
    "Expected Outcome:",
    "",
    rec.expectedOutcome,
    "",
    `Priority: ${rec.priority}`,
  ].join("\n");
}

export function formatBusinessImpactSummary(
  intro: string,
  recommendations: BusinessImpactRecommendation[],
  footer?: string,
): string {
  const blocks = recommendations.map((rec, i) => formatBusinessImpactBlock(rec, i + 1));
  return [intro, "", blocks.join("\n\n--------------------------------\n\n"), footer]
    .filter(Boolean)
    .join("\n");
}

export function copilotProposalToBusinessImpact(
  proposal: CoPilotActionProposal,
  impactScore: number,
): BusinessImpactRecommendation {
  const category = categoryFromCopilot(proposal);
  const weightedScore = applyCategoryWeight(impactScore, category);

  const situation = proposal.observedChange;
  const isCommercial =
    proposal.sourceType === "opportunity" || proposal.sourceType === "document";

  return {
    id: proposal.id,
    entityName: proposal.companyName ?? proposal.objectName ?? "Account",
    category,
    situation,
    impact: isCommercial
      ? proposal.impact.replace(/CRM hygiene/i, "Commercial momentum and contract timing")
      : proposal.impact,
    recommendedAction: proposal.title,
    estimatedEffort:
      proposal.kind === "complete_commitment" ? "Less than 5 minutes" : "Less than 10 minutes",
    expectedOutcome: expectedOutcomeForCopilot(proposal),
    priority: priorityFromScore(weightedScore),
    impactScore: weightedScore,
    href: proposal.href,
    source: "CRM Co-Pilot",
  };
}

function categoryFromCopilot(proposal: CoPilotActionProposal): BusinessImpactCategory {
  switch (proposal.sourceType) {
    case "opportunity":
      return "opportunity";
    case "relationship":
      return "relationship";
    case "document":
      return "commercial";
    case "meeting":
    case "email":
      return "commercial";
    default:
      return "crm_admin";
  }
}

function expectedOutcomeForCopilot(proposal: CoPilotActionProposal): string {
  switch (proposal.kind) {
    case "complete_commitment":
      return "Customer sees reliable follow-through; deal timeline stays credible.";
    case "schedule_follow_up":
      return "Relationship momentum restored; next commercial conversation scheduled.";
    case "draft_email":
      return "Customer receives timely follow-up; quotation or proposal stays active.";
    case "review_opportunity":
      return "Commercial risks identified early; resource allocation aligned with deal value.";
    case "review_document":
      return "Contract readiness improves; fewer surprises in negotiation.";
    case "log_meeting_outcome":
      return "Institutional knowledge captured; team alignment on next commercial steps.";
    case "create_activity":
      return "Customer engagement recorded; pipeline intelligence strengthens.";
    case "create_opportunity":
      return "Commercial pipeline reflects real demand; resources focus on true opportunities.";
    case "classify_company":
      return "SmartAssist recommends the right next action for this relationship — not a fake sales pipeline.";
    default:
      return "CRM stays accurate with minimal effort from you.";
  }
}

export function overdueCommitmentToBusinessImpact(input: {
  id: string;
  entityName: string;
  daysLate: number;
  commitmentText: string;
  dealValueLabel?: string;
  impactScore: number;
  href?: string;
}): BusinessImpactRecommendation {
  const category: BusinessImpactCategory = "relationship";
  const weightedScore = applyCategoryWeight(input.impactScore, category);

  return {
    id: input.id,
    entityName: input.entityName,
    category,
    situation: `An overdue commitment is now ${input.daysLate || "several"} day${input.daysLate === 1 ? "" : "s"} late — "${input.commitmentText}".`,
    impact: input.dealValueLabel
      ? `Relationship trust is eroding and ${input.dealValueLabel} in pipeline value may stall without follow-through.`
      : "Relationship trust and opportunity momentum are at risk when commitments slip.",
    recommendedAction: `Complete or reschedule: ${input.commitmentText}`,
    estimatedEffort: "Less than 5 minutes",
    expectedOutcome:
      "Customer confidence restored; deal progression resumes without credibility gap.",
    priority: priorityFromScore(weightedScore),
    impactScore: weightedScore,
    href: input.href,
    source: "Open commitment",
  };
}

export function relationshipRiskToBusinessImpact(input: {
  id: string;
  entityName: string;
  headline: string;
  reason: string;
  recommendedAction: string;
  dealValueLabel?: string;
  impactScore: number;
  href?: string;
}): BusinessImpactRecommendation {
  const category: BusinessImpactCategory =
    input.reason === "stalled_opportunity" ? "opportunity" : "relationship";
  const weightedScore = applyCategoryWeight(input.impactScore, category);

  return {
    id: input.id,
    entityName: input.entityName,
    category,
    situation: input.headline,
    impact:
      input.reason === "stalled_opportunity"
        ? `Revenue timing at risk${input.dealValueLabel ? ` on ${input.dealValueLabel}` : ""} — stalled deals lose executive attention.`
        : "Declining relationship health reduces influence in commercial conversations and weakens deal sponsorship.",
    recommendedAction: input.recommendedAction,
    estimatedEffort: "Less than 15 minutes",
    expectedOutcome:
      input.reason === "stalled_opportunity"
        ? "Opportunity re-engaged; contract path becomes visible again."
        : "Customer relationship stabilised; future commercial discussions remain open.",
    priority: priorityFromScore(weightedScore),
    impactScore: weightedScore,
    href: input.href,
    source: "Relationship health",
  };
}

export function opportunityRiskToBusinessImpact(input: {
  id: string;
  entityName: string;
  healthStatus: string;
  healthSummary: string;
  dealValueLabel: string;
  recommendedAction: string;
  impactScore: number;
  href?: string;
}): BusinessImpactRecommendation {
  const category: BusinessImpactCategory = "opportunity";
  const weightedScore = applyCategoryWeight(input.impactScore, category);

  return {
    id: input.id,
    entityName: input.entityName,
    category,
    situation: `${input.healthStatus} — ${input.healthSummary}`,
    impact: `${input.dealValueLabel} in pipeline value faces commercial risk — delayed action reduces win probability and contract readiness.`,
    recommendedAction: input.recommendedAction,
    estimatedEffort: "15–30 minutes",
    expectedOutcome:
      "Commercial blockers surfaced and addressed; path to signed contract clarified.",
    priority: priorityFromScore(weightedScore),
    impactScore: weightedScore,
    href: input.href,
    source: "Opportunity health",
  };
}

export function attentionItemToBusinessImpact(input: {
  id: string;
  entityName: string;
  situation: string;
  severity: string;
  recommendedAction: string;
  impactScore: number;
  href?: string;
  source: string;
}): BusinessImpactRecommendation {
  const category = categoryFromSource(input.source, input.situation);
  const weightedScore = applyCategoryWeight(input.impactScore, category);
  const isUrgent = input.severity === "urgent";

  return {
    id: input.id,
    entityName: input.entityName,
    category,
    situation: input.situation,
    impact: isUrgent
      ? "High revenue or relationship impact if this remains unresolved."
      : category === "crm_admin"
        ? "Administrative gap — lower priority than active commercial risks."
        : "Commercial or relationship progress may slow without intervention.",
    recommendedAction: input.recommendedAction,
    estimatedEffort: category === "crm_admin" ? "Less than 5 minutes" : "10–20 minutes",
    expectedOutcome:
      category === "opportunity" || category === "commercial"
        ? "Deal progression accelerates; commercial intelligence stays current."
        : "Relationship maintained; portfolio visibility improves.",
    priority: priorityFromScore(weightedScore),
    impactScore: weightedScore,
    href: input.href,
    source: input.source,
  };
}

export function rankBusinessImpactRecommendations(
  recommendations: BusinessImpactRecommendation[],
): BusinessImpactRecommendation[] {
  const categoryOrder: Record<BusinessImpactCategory, number> = {
    opportunity: 0,
    commercial: 1,
    relationship: 2,
    crm_admin: 3,
  };

  const seen = new Set<string>();
  return [...recommendations]
    .sort((a, b) => {
      const scoreDiff = b.impactScore - a.impactScore;
      if (scoreDiff !== 0) return scoreDiff;
      return categoryOrder[a.category] - categoryOrder[b.category];
    })
    .filter((rec) => {
      const key = `${rec.entityName}:${rec.situation.slice(0, 50)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function businessImpactIntro(displayName: string, mode: string): string {
  const hour = new Date().getHours();
  const firstName = displayName.split(" ")[0] ?? displayName;
  const greeting =
    hour < 12
      ? `Good morning ${firstName}`
      : hour < 17
        ? `Good afternoon ${firstName}`
        : hour < 21
          ? `Good evening ${firstName}`
          : `Welcome back ${firstName}`;

  return `${greeting}.\n\n${mode}`;
}

export const BUSINESS_IMPACT_ADVISOR_NOTE = SMARTASSIST_BUSINESS_IMPACT.advisorNote;
