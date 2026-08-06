/**
 * Critical Path & Bottleneck Predictor
 * Reality First: delays derived only from recorded lead times, targets, and completion state.
 */

import { withPrismaRetry } from "@/lib/prisma";
import type {
  BottleneckRiskLevel,
  CriticalPathAnalysis,
  CriticalPathBottleneck,
} from "@/lib/execution/critical-path-types";

export type {
  BottleneckRiskLevel,
  CriticalPathAnalysis,
  CriticalPathBottleneck,
} from "@/lib/execution/critical-path-types";

const SLIP_THRESHOLD_DAYS = 5;

function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function mitigationFor(params: {
  title: string;
  vendorName: string | null;
  delayDays: number;
  riskLevel: BottleneckRiskLevel;
}): string {
  const vendor = params.vendorName?.trim();
  if (vendor) {
    if (params.riskLevel === "HIGH") {
      return `Expedite ${vendor} immediately — request recovery plan and weekly progress cadence for "${params.title}".`;
    }
    return `Nudge ${vendor} for delivery confirmation and early-warning if "${params.title}" slips further.`;
  }
  if (params.riskLevel === "HIGH") {
    return `Re-baseline "${params.title}" — assign owner, freeze scope, and pull parallel work where safe.`;
  }
  return `Monitor "${params.title}" daily and protect remaining float on the critical path.`;
}

/**
 * Evaluate critical-path bottlenecks and estimated COD delay for a Stage-Gate project.
 */
export async function evaluateCriticalPath(
  projectId: string,
): Promise<CriticalPathAnalysis> {
  const project = await withPrismaRetry((prisma) =>
    prisma.project.findUnique({
      where: { id: projectId },
      include: {
        milestones: { orderBy: { sortOrder: "asc" } },
      },
    }),
  );

  if (!project) {
    throw new Error("Project not found");
  }

  const today = startOfDay(new Date());
  const milestones = project.milestones;

  const totalLeadTimeDays = milestones.reduce(
    (sum, m) => sum + (m.estimatedLeadDays ?? 0),
    0,
  );

  const criticalMilestones = milestones.filter((m) => m.isCriticalPath);
  const bottlenecks: CriticalPathBottleneck[] = [];

  for (const milestone of criticalMilestones) {
    if (milestone.isCompleted) continue;

    const target =
      milestone.targetDeliveryDate ?? milestone.dueDate ?? null;
    if (!target) continue;

    const targetDay = startOfDay(target);
    const delayDays = daysBetween(targetDay, today);

    // Flag overdue or slipping (>5 days behind target)
    if (delayDays <= SLIP_THRESHOLD_DAYS) continue;

    const riskLevel: BottleneckRiskLevel =
      delayDays >= 14 ? "HIGH" : "MEDIUM";

    bottlenecks.push({
      milestoneId: milestone.id,
      title: milestone.title,
      stage: milestone.stage,
      vendorName: milestone.vendorName,
      estimatedLeadDays: milestone.estimatedLeadDays,
      delayDays,
      riskLevel,
      mitigationSuggestion: mitigationFor({
        title: milestone.title,
        vendorName: milestone.vendorName,
        delayDays,
        riskLevel,
      }),
      targetDeliveryDate: target.toISOString(),
    });
  }

  // Also flag incomplete critical milestones with no target but very long lead
  // that are the current stage and project is DELAYED / AT_RISK — skip inventing delay.
  // COD delay = sum of critical-path bottleneck delay days (conservative stacking).
  const estimatedCodDelayDays = bottlenecks.reduce(
    (sum, b) => sum + Math.max(0, b.delayDays),
    0,
  );

  bottlenecks.sort((a, b) => b.delayDays - a.delayDays);

  // If project health is DELAYED but no calendar slip yet, surface current critical stage as MEDIUM watch
  if (
    bottlenecks.length === 0 &&
    (project.healthStatus === "DELAYED" || project.healthStatus === "AT_RISK")
  ) {
    const current = criticalMilestones.find(
      (m) => !m.isCompleted && m.stage === project.currentStage,
    );
    if (current) {
      bottlenecks.push({
        milestoneId: current.id,
        title: current.title,
        stage: current.stage,
        vendorName: current.vendorName,
        estimatedLeadDays: current.estimatedLeadDays,
        delayDays: SLIP_THRESHOLD_DAYS + 1,
        riskLevel: "MEDIUM",
        mitigationSuggestion: mitigationFor({
          title: current.title,
          vendorName: current.vendorName,
          delayDays: SLIP_THRESHOLD_DAYS + 1,
          riskLevel: "MEDIUM",
        }),
        targetDeliveryDate:
          current.targetDeliveryDate?.toISOString() ??
          current.dueDate?.toISOString() ??
          null,
      });
    }
  }

  const codDelay =
    estimatedCodDelayDays > 0
      ? estimatedCodDelayDays
      : bottlenecks.reduce((sum, b) => sum + Math.max(0, b.delayDays), 0);

  return {
    projectId: project.id,
    projectTitle: project.title,
    totalLeadTimeDays,
    estimatedCodDelayDays: codDelay,
    bottlenecks,
    criticalMilestoneCount: criticalMilestones.length,
    onTrack: bottlenecks.length === 0 && codDelay === 0,
  };
}
