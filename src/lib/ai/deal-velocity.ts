/**
 * FS-012 — Deal Velocity & Risk scoring
 * Deterministic risk / velocity from known deal signals.
 */

import type { PipelineRow, PipelineStatus } from "@/types/pipeline";
import { getLifecycleStage } from "@/types/pipeline";
import { daysBetween } from "@/lib/relative-time";

export type DealRiskLevel = "LOW" | "MEDIUM" | "HIGH";

export type DealVelocityNextAction = {
  action: string;
  reason: string;
  impact: string;
  priority: "High" | "Medium" | "Low";
};

export type DealVelocityInput = {
  id: string;
  assetName: string;
  status: PipelineStatus;
  salesValue?: number;
  probability?: number;
  expectedCloseDate?: string | null;
  /** ISO datetime of last related activity, if known */
  lastActivityAt?: string | null;
  /** Activities in last 30 days */
  activityCount30d?: number;
  /** Open / overdue follow-ups */
  openCommitments?: number;
  overdueActions?: number;
  hasOwner?: boolean;
  offeringCount?: number;
};

export type DealVelocityResult = {
  riskLevel: DealRiskLevel;
  /** 0–100 — higher = healthier commercial momentum */
  velocityScore: number;
  nextBestActions: DealVelocityNextAction[];
  signals: string[];
  summary: string;
};

function asDealInput(deal: PipelineRow | DealVelocityInput): DealVelocityInput {
  if ("assetName" in deal && "status" in deal) {
    return {
      id: deal.id,
      assetName: deal.assetName,
      status: deal.status,
      salesValue: deal.salesValue,
      probability: deal.probability,
      expectedCloseDate: deal.expectedCloseDate,
      lastActivityAt: "lastActivityAt" in deal ? deal.lastActivityAt : undefined,
      activityCount30d: "activityCount30d" in deal ? deal.activityCount30d : undefined,
      openCommitments: "openCommitments" in deal ? deal.openCommitments : undefined,
      overdueActions: "overdueActions" in deal ? deal.overdueActions : undefined,
      hasOwner:
        "hasOwner" in deal
          ? deal.hasOwner
          : Boolean((deal as PipelineRow).opportunityOwner),
      offeringCount:
        "offeringCount" in deal
          ? deal.offeringCount
          : (deal as PipelineRow).offeringIds?.length ?? 0,
    };
  }
  return deal;
}

const STAGE_BASE: Partial<Record<PipelineStatus, number>> = {
  Prospecting: 55,
  "Feedstock Analysis": 62,
  "Contract Negotiation": 70,
  Won: 85,
  "Reactor Manufacturing": 80,
  "Site Installation": 78,
  "Commissioning Phase": 75,
  "Live Production": 90,
  "Scheduled Maintenance": 70,
};

/**
 * Calculate deal risk level, velocity score (0–100), and next-best-action recommendations.
 */
export function calculateDealRiskScore(
  deal: PipelineRow | DealVelocityInput,
): DealVelocityResult {
  const input = asDealInput(deal);
  const signals: string[] = [];
  const nextBestActions: DealVelocityNextAction[] = [];

  let score = STAGE_BASE[input.status] ?? 50;
  const lifecycle = getLifecycleStage(input.status);

  const daysSinceActivity =
    input.lastActivityAt != null
      ? daysBetween(input.lastActivityAt)
      : null;

  if (daysSinceActivity == null) {
    score -= 12;
    signals.push("No recent activity timestamp available");
    nextBestActions.push({
      action: "Log the latest customer interaction",
      reason: "Velocity cannot be confirmed without activity evidence.",
      impact: "Restores a reliable momentum signal for prioritization.",
      priority: "High",
    });
  } else if (daysSinceActivity > 21) {
    score -= 22;
    signals.push(`Silent for ${daysSinceActivity} days`);
    nextBestActions.push({
      action: "Schedule a stakeholder check-in this week",
      reason: `No recorded touch in ${daysSinceActivity} days — momentum is cooling.`,
      impact: "Prevents the opportunity from slipping into a stalled state.",
      priority: "High",
    });
  } else if (daysSinceActivity > 10) {
    score -= 10;
    signals.push(`Last touch ${daysSinceActivity} days ago`);
  } else {
    score += 8;
    signals.push(`Active within ${daysSinceActivity} days`);
  }

  const activity30 = input.activityCount30d ?? 0;
  if (activity30 === 0) {
    score -= 8;
    signals.push("No activity in the last 30 days");
  } else if (activity30 >= 4) {
    score += 10;
    signals.push(`${activity30} activities in 30 days`);
  } else {
    score += 4;
    signals.push(`${activity30} activities in 30 days`);
  }

  const overdue = input.overdueActions ?? 0;
  if (overdue > 0) {
    score -= Math.min(20, overdue * 8);
    signals.push(`${overdue} overdue action${overdue === 1 ? "" : "s"}`);
    nextBestActions.push({
      action: "Clear overdue commitments before advancing stage",
      reason: "Open overdue actions erode trust and slow commercial progress.",
      impact: "Removes execution drag and improves close predictability.",
      priority: "High",
    });
  }

  const open = input.openCommitments ?? 0;
  if (open > 3) {
    score -= 6;
    signals.push(`${open} open commitments`);
  }

  if (input.hasOwner === false) {
    score -= 10;
    signals.push("No opportunity owner assigned");
    nextBestActions.push({
      action: "Assign an opportunity owner",
      reason: "Unowned deals stall because nobody owns the next commercial move.",
      impact: "Creates clear accountability for progression.",
      priority: "High",
    });
  }

  if ((input.offeringCount ?? 0) === 0 && lifecycle === "sales") {
    score -= 8;
    signals.push("Offerings not defined");
    nextBestActions.push({
      action: "Confirm Standard Bio offerings in scope",
      reason: "Without offerings, discovery and commercial packaging stay vague.",
      impact: "Sharpens qualification and proposal readiness.",
      priority: "Medium",
    });
  }

  if (input.expectedCloseDate) {
    const closeIn = Math.round(
      (new Date(input.expectedCloseDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
    if (closeIn < 0 && !["Won", "Live Production"].includes(input.status)) {
      score -= 15;
      signals.push("Expected close date is past due");
      nextBestActions.push({
        action: "Re-baseline expected close date with the customer",
        reason: "The forecast date has slipped — the plan is no longer credible.",
        impact: "Restores forecast integrity and forces a real next step.",
        priority: "High",
      });
    } else if (closeIn <= 14 && lifecycle === "sales") {
      score += 5;
      signals.push(`Close window in ${closeIn} days`);
      nextBestActions.push({
        action: "Confirm decision criteria and remaining blockers",
        reason: "Close window is near — ambiguity now becomes lost revenue.",
        impact: "Raises win probability in the final stretch.",
        priority: "High",
      });
    }
  } else if (lifecycle === "sales") {
    score -= 5;
    signals.push("No expected close date");
  }

  const probability = input.probability ?? 0;
  if (probability > 0 && probability < 30 && input.status === "Contract Negotiation") {
    score -= 8;
    signals.push(`Low probability (${probability}%) in negotiation`);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let riskLevel: DealRiskLevel = "LOW";
  if (score < 45) riskLevel = "HIGH";
  else if (score < 70) riskLevel = "MEDIUM";

  if (nextBestActions.length === 0) {
    nextBestActions.push({
      action:
        lifecycle === "sales"
          ? "Advance one qualification gap with a concrete customer ask"
          : "Confirm the next delivery milestone owner and date",
      reason: "Momentum is acceptable — keep one clear commercial/delivery motion in flight.",
      impact: "Protects velocity and prevents silent stall.",
      priority: "Medium",
    });
  }

  const summary = `${input.assetName} is ${riskLevel.toLowerCase()} risk with velocity ${score}/100 at ${input.status}.`;

  return {
    riskLevel,
    velocityScore: score,
    nextBestActions: nextBestActions.slice(0, 4),
    signals,
    summary,
  };
}
