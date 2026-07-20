import type { RelationshipHealthReport } from "@/lib/relationship-health-engine";
import {
  getHealthScoreExplanation,
  HEALTH_STATUS_STYLES,
  TREND_STYLES,
  type NextBestAction,
  type RecommendedAction,
  type RelationshipHealthStatus,
  type RelationshipTrend,
} from "@/lib/relationship-health-engine";
import {
  getNextBestActionExplanation,
  NEXT_BEST_ACTION_PRIORITY_STYLES,
} from "@/lib/next-best-action-engine";

export { HEALTH_STATUS_STYLES, TREND_STYLES };

function actionLabel(action: RecommendedAction | NextBestAction): string {
  if ("action" in action && action.action) return action.action;
  const legacy = action as RecommendedAction;
  return legacy.title ?? "";
}

export function RelationshipHealthBadge({
  status,
  className = "",
}: {
  status: RelationshipHealthStatus;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${HEALTH_STATUS_STYLES[status]} ${className}`}
    >
      {status}
    </span>
  );
}

export function RelationshipTrendBadge({
  trend,
  className = "",
}: {
  trend: RelationshipTrend;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider ${TREND_STYLES[trend]} ${className}`}
    >
      {trend === "Improving" ? "↑" : trend === "Declining" ? "↓" : "→"} {trend}
    </span>
  );
}

export function RelationshipHealthScoreRing({
  score,
  status,
  size = "md",
}: {
  score: number;
  status: RelationshipHealthStatus;
  size?: "sm" | "md" | "lg";
}) {
  const dimensions = size === "lg" ? "size-20 text-xl" : size === "sm" ? "size-12 text-sm" : "size-16 text-lg";
  const stroke =
    status === "Strategic"
      ? "#7c3aed"
      : status === "Strong"
        ? "#10b981"
        : status === "Healthy"
          ? "#0ea5e9"
          : status === "Weak"
            ? "#e65125"
            : "#ef4444";

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center rounded-full border-2 ${dimensions}`}
      style={{ borderColor: stroke }}
      aria-label={`Health score ${score} out of 100`}
    >
      <span className="font-semibold tabular-nums text-carbon-blue">{score}</span>
    </div>
  );
}

export function RelationshipHealthBreakdown({
  report,
  showEngineFootnote = false,
}: {
  report: RelationshipHealthReport;
  showEngineFootnote?: boolean;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-carbon-blue/55">{report.summary}</p>
      <ul className="space-y-2">
        {report.components.map((component) => (
          <li key={component.id} className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="font-medium text-carbon-blue/70">{component.label}</span>
              <span className="tabular-nums text-carbon-blue/50">
                {component.score}
                <span className="text-carbon-blue/30">
                  {" "}
                  × {(component.weight * 100).toFixed(0)}%
                </span>
                <span className="ml-1 font-semibold text-carbon-blue">
                  = {component.weightedContribution}
                </span>
              </span>
            </div>
            <div className="h-1 overflow-hidden bg-carbon-blue/8">
              <div
                className="h-full bg-upcycle-orange/80 transition-all duration-300"
                style={{ width: `${component.score}%` }}
              />
            </div>
            <p className="text-[10px] text-carbon-blue/45">{component.detail}</p>
          </li>
        ))}
      </ul>
      {showEngineFootnote ? (
        <p className="border-t border-carbon-blue/8 pt-2 text-[10px] text-carbon-blue/40">
          {getHealthScoreExplanation()}
        </p>
      ) : null}
    </div>
  );
}

export function NextBestActionCard({
  action,
  compact = false,
  showConfidence = false,
}: {
  action: RecommendedAction | NextBestAction;
  compact?: boolean;
  showConfidence?: boolean;
}) {
  const label = actionLabel(action);

  if (compact) {
    return (
      <div className="text-[11px] leading-relaxed text-carbon-blue/55">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-flex border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${NEXT_BEST_ACTION_PRIORITY_STYLES[action.priority]}`}
          >
            {action.priority}
          </span>
          {showConfidence ? (
            <span className="text-[9px] font-semibold tabular-nums text-carbon-blue/40">
              {action.confidenceScore}% confidence
            </span>
          ) : null}
        </div>
        <p className="mt-1">
          <span className="font-medium text-carbon-blue/75">{label}</span>
          <span className="text-carbon-blue/45"> — {action.reason}</span>
        </p>
      </div>
    );
  }

  return (
    <div
      className={`border px-4 py-3 ${NEXT_BEST_ACTION_PRIORITY_STYLES[action.priority]}`}
    >
      <p className="text-[9px] font-semibold uppercase tracking-wider opacity-70">
        Next best action
      </p>
      <p className="mt-1 text-sm font-semibold">{label}</p>
      <p className="mt-1 text-[11px] leading-relaxed opacity-80">{action.reason}</p>
    </div>
  );
}

/** @deprecated Use NextBestActionCard */
export const RecommendedActionCard = NextBestActionCard;

/** @deprecated Use getNextBestActionExplanation */
export { getNextBestActionExplanation };

/** @deprecated Use Company360HealthBadge */
export function Company360HealthBadge({
  label,
  className = "",
}: {
  label: string;
  className?: string;
}) {
  const status = label as RelationshipHealthStatus;
  if (HEALTH_STATUS_STYLES[status]) {
    return <RelationshipHealthBadge status={status} className={className} />;
  }
  return (
    <span
      className={`inline-flex items-center border border-carbon-blue/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/60 ${className}`}
    >
      {label}
    </span>
  );
}

export const HEALTH_STYLES = HEALTH_STATUS_STYLES;
