"use client";

import type { BusinessImpactRecommendation } from "@/types/smart-assist-business-impact";

const CATEGORY_LABEL: Record<BusinessImpactRecommendation["category"], string> = {
  opportunity: "Opportunity",
  commercial: "Commercial",
  relationship: "Relationship",
  crm_admin: "CRM",
};

function priorityClass(priority: BusinessImpactRecommendation["priority"]): string {
  switch (priority) {
    case "Critical":
      return "text-red-700";
    case "High":
      return "text-upcycle-orange";
    default:
      return "text-carbon-blue/55";
  }
}

export function BusinessImpactCard({
  recommendation,
  compact = false,
}: {
  recommendation: BusinessImpactRecommendation;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold text-carbon-blue">{recommendation.entityName}</p>
        <ImpactRow label="Impact" value={recommendation.impact} />
        <ImpactRow label="Action" value={recommendation.recommendedAction} accent />
      </div>
    );
  }

  return (
    <article className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold text-carbon-blue">{recommendation.entityName}</p>
        <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-carbon-blue/35">
          {CATEGORY_LABEL[recommendation.category]}
        </span>
      </div>
      <ImpactRow label="Situation" value={recommendation.situation} />
      <ImpactRow label="Impact" value={recommendation.impact} />
      <ImpactRow label="Recommended Action" value={recommendation.recommendedAction} accent />
      <ImpactRow label="Estimated Effort" value={recommendation.estimatedEffort} />
      <ImpactRow label="Expected Outcome" value={recommendation.expectedOutcome} />
      <p className={`text-[9px] font-semibold uppercase tracking-wider ${priorityClass(recommendation.priority)}`}>
        Priority: {recommendation.priority}
      </p>
    </article>
  );
}

function ImpactRow({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-wider text-carbon-blue/40">{label}</p>
      <p
        className={`mt-0.5 text-[10px] leading-relaxed ${
          accent ? "font-medium text-upcycle-orange" : "text-carbon-blue/65"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
