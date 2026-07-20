import type {
  OpportunityHealthStatus,
  OpportunityIntelligence,
  OpportunityMomentum,
  OpportunityNextBestAction,
} from "@/lib/opportunity-intelligence-engine";
import {
  OPPORTUNITY_HEALTH_STYLES,
  OPPORTUNITY_MOMENTUM_STYLES,
  getOpportunityIntelligenceExplanation,
} from "@/lib/opportunity-intelligence-engine";
import { NEXT_BEST_ACTION_PRIORITY_STYLES } from "@/lib/next-best-action-engine";

export { OPPORTUNITY_HEALTH_STYLES, OPPORTUNITY_MOMENTUM_STYLES };

export function OpportunityHealthBadge({
  status,
  className = "",
}: {
  status: OpportunityHealthStatus;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${OPPORTUNITY_HEALTH_STYLES[status]} ${className}`}
    >
      {status}
    </span>
  );
}

export function OpportunityMomentumBadge({
  momentum,
  className = "",
}: {
  momentum: OpportunityMomentum;
  className?: string;
}) {
  const icon =
    momentum === "Accelerating"
      ? "↑"
      : momentum === "Stalled"
        ? "⏸"
        : momentum === "Slowing"
          ? "↓"
          : "→";

  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider ${OPPORTUNITY_MOMENTUM_STYLES[momentum]} ${className}`}
    >
      {icon} {momentum}
    </span>
  );
}

export function OpportunityHealthScore({
  score,
  status,
  size = "md",
}: {
  score: number;
  status: OpportunityHealthStatus;
  size?: "sm" | "md" | "lg";
}) {
  const dimensions =
    size === "lg" ? "size-16 text-lg" : size === "sm" ? "size-10 text-xs" : "size-12 text-sm";
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
      className={`flex shrink-0 items-center justify-center rounded-full border-2 font-bold tabular-nums ${dimensions}`}
      style={{ borderColor: stroke }}
    >
      {score}
    </div>
  );
}

export function OpportunityNextBestActionCard({
  action,
  compact = false,
}: {
  action: OpportunityNextBestAction;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="text-[11px] leading-relaxed text-carbon-blue/55">
        <span
          className={`mr-1.5 inline-flex border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${NEXT_BEST_ACTION_PRIORITY_STYLES[action.priority]}`}
        >
          {action.priority}
        </span>
        <span className="font-medium text-carbon-blue/75">{action.action}</span>
        <span className="text-carbon-blue/45"> — {action.reason}</span>
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
      <p className="mt-1 text-sm font-semibold">{action.action}</p>
      <p className="mt-1 text-[11px] leading-relaxed opacity-80">{action.reason}</p>
    </div>
  );
}

export function OpportunityIntelligenceBreakdown({
  intelligence,
  showEngineFootnote = false,
}: {
  intelligence: OpportunityIntelligence;
  showEngineFootnote?: boolean;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-carbon-blue/55">{intelligence.healthSummary}</p>
      <ul className="space-y-2">
        {intelligence.components.map((component) => (
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
                className="h-full bg-upcycle-orange/80"
                style={{ width: `${component.score}%` }}
              />
            </div>
            <p className="text-[10px] text-carbon-blue/45">{component.detail}</p>
          </li>
        ))}
      </ul>
      {showEngineFootnote ? (
        <p className="border-t border-carbon-blue/8 pt-2 text-[10px] text-carbon-blue/40">
          {getOpportunityIntelligenceExplanation()}
        </p>
      ) : null}
    </div>
  );
}

export function WinProbabilityRing({
  probability,
  size = "md",
}: {
  probability: number;
  size?: "sm" | "md";
}) {
  const dimensions = size === "sm" ? "size-10 text-xs" : "size-12 text-sm";
  const color =
    probability >= 70 ? "#10b981" : probability >= 40 ? "#0ea5e9" : "#e65125";

  return (
    <div
      className={`flex shrink-0 flex-col items-center justify-center rounded-full border-2 ${dimensions}`}
      style={{ borderColor: color }}
    >
      <span className="font-bold tabular-nums text-carbon-blue">{probability}%</span>
    </div>
  );
}
