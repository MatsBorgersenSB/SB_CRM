import type { Activity } from "@/types/activity";
import type { CommercialPackage } from "@/types/commercial-package";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import { formatDealValue } from "@/types/pipeline";
import { isQuotationKind } from "@/types/commercial-package";
import {
  isFollowUpOpen,
  isFollowUpOverdue,
} from "@/lib/activity-utils";
import { buildOpportunityCommandCenter } from "@/lib/opportunity-command-center-data";
import { buildRelationshipCommandCenter } from "@/lib/relationship-intelligence";
import { buildPortfolioCommercialViability } from "@/lib/commercial-viability-engine";
import {
  CVM_COMMERCIAL_INTELLIGENCE,
  CVM_OPERATIONAL_INTELLIGENCE,
} from "@/lib/cvm-config";
import { buildAttentionItems } from "@/lib/smart-attention-engine";
import { buildCoPilotProposals } from "@/lib/smartassist-copilot-engine";
import type { CompanyCorrespondenceEvidence } from "@/lib/company-correspondence";
import { company360Href } from "@/types/company-360";
import { deal360Href } from "@/types/relationship-navigation";
import type {
  SmartAssistFocus,
  SmartAssistItem,
  SmartAssistSectionId,
} from "@/types/smart-assist";
import type { AuthUser } from "@/types/auth";
import { resolveSmartAssistPortfolio, isCompanyOwnedByUser } from "@/lib/company-owner";

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isToday(value: string): boolean {
  if (!value) return false;
  const date = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  return startOfDay(date).getTime() === startOfDay(new Date()).getTime();
}

function isUpcoming(value: string, withinDays = 7): boolean {
  if (!value) return false;
  const date = startOfDay(new Date(value.includes("T") ? value : value.replace(" ", "T")));
  const today = startOfDay(new Date());
  const diff = Math.floor((date.getTime() - today.getTime()) / 86_400_000);
  return diff > 0 && diff <= withinDays;
}

function isMeetingType(type: Activity["ActivityType"]): boolean {
  return type === "Meeting" || type === "Teams Meeting";
}

export function buildSmartAssistGreeting(displayName: string): string {
  const hour = new Date().getHours();
  const firstName = displayName.split(" ")[0] ?? displayName;
  if (hour < 12) return `Good Morning ${firstName}`;
  if (hour < 17) return `Good Afternoon ${firstName}`;
  if (hour < 21) return `Good Evening ${firstName}`;
  return `Welcome Back ${firstName}`;
}

export function buildSmartAssistFocus(
  companies: Company[],
  pipelines: PipelineRow[],
  activities: Activity[],
  commercialPackages: CommercialPackage[],
  user: AuthUser,
  options?: {
    correspondenceByCompanyId?: Map<string, CompanyCorrespondenceEvidence>;
  },
): SmartAssistFocus {
  const portfolio = resolveSmartAssistPortfolio(companies, pipelines, activities, user);
  const {
    companies: scopedCompanies,
    pipelines: scopedPipelines,
    activities: scopedActivities,
    ownedCompanyIds,
  } = portfolio;

  const commandCenter = buildRelationshipCommandCenter(
    scopedCompanies,
    scopedPipelines,
    scopedActivities,
  );
  const oppCenter = buildOpportunityCommandCenter(scopedPipelines, scopedCompanies, scopedActivities);
  const attentionItems = buildAttentionItems({
    companies: scopedCompanies,
    pipelines: scopedPipelines,
    activities: scopedActivities,
    commercialPackages,
  }).filter((item) => item.status === "open");

  const criticalDeals = oppCenter.dealsAtRisk.filter(
    (deal) => deal.healthStatus === "At Risk",
  );
  const followUpsDue = scopedActivities.filter(
    (activity) =>
      isFollowUpOpen(activity) &&
      (isFollowUpOverdue(activity) || isToday(activity.NextActionDate)),
  );
  const openCommitments = scopedActivities.filter(isFollowUpOpen);
  const meetingsToday = scopedActivities.filter(
    (activity) => isMeetingType(activity.ActivityType) && isToday(activity.ActivityDate),
  );
  const quotationsAwaiting = commercialPackages.filter(
    (pkg) => isQuotationKind(pkg.kind) && pkg.status === "sent",
  );

  const atRiskValue = criticalDeals.reduce((sum, deal) => {
    const pipeline = scopedPipelines.find((p) => p.id === deal.dealId);
    return sum + (pipeline?.salesValue ?? 0);
  }, 0);
  const currency = scopedPipelines.find((p) => p.currency)?.currency ?? "EUR";

  const ownedAttention = attentionItems.filter((item) => {
    const companyId = item.companyId ?? item.href.match(/\/companies\/([^/?]+)/)?.[1];
    return companyId ? ownedCompanyIds.has(companyId) : false;
  });
  const routedAttention =
    user.role === "commercial" || user.role === "engineer"
      ? ownedAttention
      : [...ownedAttention, ...attentionItems.filter((item) => !ownedAttention.includes(item))];

  const topNba = commandCenter.nextBestActions.find((nba) => ownedCompanyIds.has(nba.companyId))
    ?? commandCenter.nextBestActions[0];
  const recommendedFocus =
    topNba?.action ??
    criticalDeals[0]?.dealName ??
    followUpsDue[0]?.Subject ??
    "Maintain relationship momentum across your portfolio";

  const today: SmartAssistItem[] = [];
  const upcoming: SmartAssistItem[] = [];
  const followUps: SmartAssistItem[] = [];
  const opportunities: SmartAssistItem[] = [];
  const recommendations: SmartAssistItem[] = [];

  for (const item of routedAttention.slice(0, 8)) {
    today.push({
      id: item.id,
      label: item.suggestedAiAction,
      detail: item.recommendation,
      href: item.href,
      priority:
        item.severity === "urgent"
          ? "critical"
          : item.severity === "needs_attention"
            ? "high"
            : "normal",
      emoji: item.severity === "urgent" ? "🔥" : "⚠",
    });
  }

  for (const activity of meetingsToday) {
    upcoming.push({
      id: `meeting-${activity.ActivityID}`,
      label: activity.Subject,
      detail: `${activity.ActivityType} · ${activity.Company?.Title ?? "—"}`,
      href: `/activities/${activity.ActivityID}`,
      emoji: "📅",
    });
  }

  for (const activity of scopedActivities) {
    if (!isMeetingType(activity.ActivityType)) continue;
    if (isToday(activity.ActivityDate)) continue;
    if (!isUpcoming(activity.ActivityDate)) continue;
    upcoming.push({
      id: `upcoming-${activity.ActivityID}`,
      label: activity.Subject,
      detail: `${activity.ActivityType} · ${new Date(activity.ActivityDate).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}`,
      href: `/activities/${activity.ActivityID}`,
      emoji: "📅",
    });
  }

  for (const activity of followUpsDue.slice(0, 8)) {
    followUps.push({
      id: `followup-${activity.ActivityID}`,
      label: activity.NextAction || activity.Subject,
      detail: isFollowUpOverdue(activity)
        ? `Overdue · ${activity.Company?.Title ?? ""}`
        : `Due today · ${activity.Company?.Title ?? ""}`,
      href: `/activities/${activity.ActivityID}`,
      priority: isFollowUpOverdue(activity) ? "critical" : "high",
      emoji: "⚠",
    });
  }

  for (const activity of openCommitments.slice(0, 8)) {
    if (followUpsDue.some((due) => due.ActivityID === activity.ActivityID)) continue;
    followUps.push({
      id: `commitment-${activity.ActivityID}`,
      label: activity.NextAction || activity.Subject,
      detail: `Open commitment · ${activity.Company?.Title ?? ""}`,
      href: `/activities/${activity.ActivityID}`,
      priority: "normal",
      emoji: "✅",
    });
  }

  for (const deal of oppCenter.dealsAtRisk.slice(0, 6)) {
    opportunities.push({
      id: `opp-${deal.dealId}`,
      label: deal.dealName,
      detail: `${deal.healthStatus} · ${deal.healthSummary}`,
      href: deal.href,
      priority: deal.healthStatus === "At Risk" ? "critical" : "high",
      emoji: "🎯",
    });
  }

  for (const pkg of quotationsAwaiting.slice(0, 4)) {
    opportunities.push({
      id: `quote-${pkg.PackageID}`,
      label: pkg.title || pkg.DocumentSetID,
      detail: `Quotation awaiting response · ${pkg.DealId}`,
      href: deal360Href(pkg.DealId, "commercial", { packageId: pkg.PackageID }),
      emoji: "📄",
    });
  }

  const ownedRecommendations = commandCenter.nextBestActions.filter((nba) =>
    ownedCompanyIds.has(nba.companyId),
  );
  const recommendationSource =
    ownedRecommendations.length > 0 ? ownedRecommendations : commandCenter.nextBestActions;

  for (const nba of recommendationSource.slice(0, 5)) {
    recommendations.push({
      id: `nba-${nba.companyId}-${nba.action}`,
      label: nba.action,
      detail: nba.reason,
      href: company360Href(nba.companyId, "attention"),
      priority: nba.priority === "High" ? "high" : "normal",
      emoji: "💡",
    });
  }

  const relationshipSource =
    commandCenter.relationshipsNeedingAttention.filter((rel) =>
      ownedCompanyIds.has(rel.companyId),
    ).length > 0
      ? commandCenter.relationshipsNeedingAttention.filter((rel) =>
          ownedCompanyIds.has(rel.companyId),
        )
      : commandCenter.relationshipsNeedingAttention;

  for (const rel of relationshipSource.slice(0, 4)) {
    recommendations.push({
      id: `rel-${rel.companyId}`,
      label: `Strengthen ${rel.companyName}`,
      detail: rel.detail,
      href: rel.href ?? company360Href(rel.companyId),
      priority: rel.priority === "critical" ? "critical" : "high",
      emoji: "🤝",
    });
  }

  const sections: Record<SmartAssistSectionId, SmartAssistItem[]> = {
    today,
    upcoming,
    follow_ups: followUps,
    opportunities,
    recommendations,
  };

  const opportunityCoach = buildPortfolioCommercialViability(
    scopedPipelines,
    scopedCompanies,
    scopedActivities,
    commercialPackages,
    5,
  );

  const copilotProposals = buildCoPilotProposals(
    scopedCompanies,
    scopedPipelines,
    scopedActivities,
    commercialPackages,
    { correspondenceByCompanyId: options?.correspondenceByCompanyId },
  );

  const ownedPortfolioCount = scopedCompanies.filter((company) =>
    isCompanyOwnedByUser(company, user),
  ).length;

  return {
    greeting: buildSmartAssistGreeting(user.displayName),
    generatedAt: new Date().toISOString(),
    metrics: {
      criticalOpportunities: criticalDeals.length,
      followUpsDue: followUpsDue.length,
      meetingsToday: meetingsToday.length,
      quotationsAwaiting: quotationsAwaiting.length,
      openCommitments: openCommitments.length,
      pendingCrmActions: copilotProposals.length,
      pipelineValueLabel:
        atRiskValue > 0 ? formatDealValue(currency, atRiskValue) : "—",
      recommendedFocus:
        ownedPortfolioCount > 0
          ? `${recommendedFocus} · ${ownedPortfolioCount} owned account${ownedPortfolioCount === 1 ? "" : "s"}`
          : recommendedFocus,
    },
    sections,
    copilotProposals,
    intelligenceLayers: [CVM_OPERATIONAL_INTELLIGENCE, CVM_COMMERCIAL_INTELLIGENCE],
    opportunityCoach,
  };
}
