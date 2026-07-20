import type {
  DocumentIntelligence,
  DocumentNextBestAction,
} from "@/lib/document-intelligence-engine";
import {
  BUSINESS_IMPACT_STYLES,
  DOCUMENT_HEALTH_STYLES,
  type BusinessImpactLevel,
  type DocumentHealthStatus,
} from "@/types/smartdoc";
import { NEXT_BEST_ACTION_PRIORITY_STYLES } from "@/lib/next-best-action-engine";
import { getDocumentIntelligenceExplanation } from "@/lib/document-intelligence-engine";

export { DOCUMENT_HEALTH_STYLES };

export function DocumentHealthBadge({
  status,
  className = "",
}: {
  status: DocumentHealthStatus;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${DOCUMENT_HEALTH_STYLES[status]} ${className}`}
    >
      {status}
    </span>
  );
}

export function BusinessImpactBadge({
  level,
  className = "",
}: {
  level: BusinessImpactLevel;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${BUSINESS_IMPACT_STYLES[level]} ${className}`}
    >
      {level} impact
    </span>
  );
}

export function DocumentHealthBreakdown({
  intelligence,
  showEngineFootnote = false,
}: {
  intelligence: DocumentIntelligence;
  showEngineFootnote?: boolean;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-carbon-blue/55">{intelligence.summary}</p>
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
          {getDocumentIntelligenceExplanation()}
        </p>
      ) : null}
    </div>
  );
}

export function DocumentNextBestActionCard({
  action,
  compact = false,
}: {
  action: DocumentNextBestAction;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <p className="text-[11px] text-carbon-blue/55">
        <span
          className={`mr-1.5 inline-flex border px-1.5 py-0.5 text-[9px] font-semibold uppercase ${NEXT_BEST_ACTION_PRIORITY_STYLES[action.priority]}`}
        >
          {action.priority}
        </span>
        <span className="font-medium text-carbon-blue/75">{action.action}</span>
        <span className="text-carbon-blue/45"> — {action.reason}</span>
      </p>
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

export function DocumentSmartInsightsPanel({
  intelligence,
}: {
  intelligence: DocumentIntelligence;
}) {
  const { insights } = intelligence;
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {[
        { label: "Business impact", value: insights.businessImpact, full: true },
        {
          label: "Impact level",
          value: insights.businessImpactLevel,
          badge: true,
        },
        { label: "Usage frequency", value: insights.usageFrequencyLabel },
        {
          label: "Linked companies",
          value: String(insights.linkedCompanyCount),
        },
        {
          label: "Linked contacts",
          value: String(insights.linkedContactCount),
        },
        {
          label: "Activity references",
          value: String(insights.activityReferenceCount),
        },
        {
          label: "Opportunity references",
          value: String(insights.opportunityReferenceCount),
        },
        {
          label: "Relationship dependencies",
          value: insights.relationshipDependency,
          full: true,
        },
      ].map((row) => (
        <div
          key={row.label}
          className={`border border-carbon-blue/8 px-3 py-2.5 ${row.full ? "sm:col-span-2" : ""}`}
        >
          <dt className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            {row.label}
          </dt>
          <dd className="mt-1 text-[11px] leading-relaxed text-carbon-blue/70">
            {"badge" in row && row.badge ? (
              <BusinessImpactBadge level={insights.businessImpactLevel} />
            ) : (
              row.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
