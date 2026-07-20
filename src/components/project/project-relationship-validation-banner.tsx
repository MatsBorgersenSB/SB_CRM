"use client";

import type { ProjectRelationshipValidation } from "@/types/project-relationships";
import {
  SmartAssistCategoryBadge,
  SmartAssistConfidenceLabel,
} from "@/components/smartassist/smartassist-intelligence-display";

export function ProjectRelationshipValidationBanner({
  validation,
  compact = false,
}: {
  validation: ProjectRelationshipValidation;
  compact?: boolean;
}) {
  if (!validation.detected) return null;

  return (
    <div className="border border-amber-200/80 bg-amber-50/80 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <SmartAssistCategoryBadge category="assumed" />
        <SmartAssistConfidenceLabel confidence="medium" />
      </div>
      <p className="mt-2 text-[13px] font-semibold text-carbon-blue">{validation.message}</p>
      <p className="mt-1 text-[12px] text-carbon-blue/65">{validation.detail}</p>
      {!compact ? (
        <p className="mt-1 text-[12px] text-carbon-blue/55">{validation.recommendedAction}</p>
      ) : null}
    </div>
  );
}
