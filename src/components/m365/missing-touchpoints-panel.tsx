"use client";

import { useMemo } from "react";
import { AssistantRecommendationCard } from "@/components/administration/assistant-recommendation-card";
import { OutlookReconciliationCard } from "@/components/m365/outlook-reconciliation-card";
import {
  analyzeOutlookReconciliation,
  toActionableTouchpoint,
} from "@/lib/outlook-reconciliation-engine";
import { OUTLOOK_RELATIONSHIP_RECONCILIATION } from "@/lib/smart-assist-config";
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
        Outlook is not connected. Connect M365 to detect missing touchpoints.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="border border-upcycle-orange/20 bg-upcycle-orange/[0.04] px-3 py-2.5">
        <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-upcycle-orange">
          SmartAssist · {OUTLOOK_RELATIONSHIP_RECONCILIATION.title}
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-carbon-blue/70">{audit.summary}</p>
        <p className="mt-1 text-[10px] italic text-carbon-blue/50">
          {OUTLOOK_RELATIONSHIP_RECONCILIATION.mantra}
        </p>
      </div>

      {touchpoints.length === 0 ? (
        <p className="px-1 text-xs text-carbon-blue/50">
          No missing touchpoints detected — CRM reflects connected Outlook activity.
        </p>
      ) : (
        <>
          <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            Potential missing touchpoints ({touchpoints.length})
          </p>
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
