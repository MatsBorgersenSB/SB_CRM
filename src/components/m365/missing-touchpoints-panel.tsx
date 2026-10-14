"use client";

import { useMemo } from "react";
import { AssistantRecommendationCard } from "@/components/administration/assistant-recommendation-card";
import { OutlookReconciliationCard } from "@/components/m365/outlook-reconciliation-card";
import {
  analyzeOutlookReconciliation,
  toActionableTouchpoint,
} from "@/lib/outlook-reconciliation-engine";
import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { OutlookEvidenceRecord } from "@/types/outlook-reconciliation";
import type { PipelineRow } from "@/types/pipeline";

export function MissingTouchpointsPanel({
  companies,
  pipelines,
  activities,
  outlookEvidence,
  connected = true,
  entityFilter,
  onImported,
}: {
  companies: Company[];
  pipelines: PipelineRow[];
  activities: Activity[];
  outlookEvidence: OutlookEvidenceRecord[];
  connected?: boolean;
  entityFilter?: {
    entityType?: "contact" | "company" | "opportunity";
    entityId?: string;
  };
  onImported?: () => void;
}) {
  const audit = useMemo(
    () =>
      analyzeOutlookReconciliation({
        companies,
        pipelines,
        activities,
        outlookEvidence,
        connected,
      }),
    [companies, pipelines, activities, outlookEvidence, connected],
  );

  const touchpoints = useMemo(() => {
    if (!entityFilter?.entityId) return audit.missingTouchpoints;
    return audit.missingTouchpoints.filter(
      (row) =>
        row.entityId === entityFilter.entityId &&
        (!entityFilter.entityType || row.entityType === entityFilter.entityType),
    );
  }, [audit.missingTouchpoints, entityFilter]);

  if (!connected) {
    return (
      <p className="px-1 text-xs text-carbon-blue/50">
        Outlook is not connected.{" "}
        <a
          href="/api/auth/m365/login"
          className="font-semibold text-upcycle-orange hover:underline"
        >
          Connect Microsoft 365
        </a>{" "}
        to detect missing touchpoints.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] leading-relaxed text-carbon-blue/70">{audit.summary}</p>

      {touchpoints.length === 0 ? (
        <p className="px-1 text-[13px] text-carbon-blue/65">
          Nothing to add — SmartCRM already reflects what Outlook has seen.
        </p>
      ) : (
        <>
          {touchpoints.map((candidate) => (
            <OutlookReconciliationCard
              key={candidate.id}
              candidate={candidate}
              onImported={onImported}
            />
          ))}
          {touchpoints.length === 1 ? (
            <AssistantRecommendationCard
              recommendation={toActionableTouchpoint(touchpoints[0]!)}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
