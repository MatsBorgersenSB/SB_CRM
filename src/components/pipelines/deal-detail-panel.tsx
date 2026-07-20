"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { PipelineRow, PipelineTeamMember } from "@/types/pipeline";
import type { SmartDocLibraryRecord } from "@/types/smartdoc-library";
import { ActivityTimeline } from "@/components/activities/activity-timeline";
import { EntityTabBar } from "@/components/ui/entity-tab-bar";
import { PipelineDetail } from "@/components/data/pipeline-detail";
import { DealCommercialBaselinePanel } from "@/components/pipelines/deal-commercial-baseline-panel";
import { DealDocumentsPanel } from "@/components/pipelines/deal-documents-panel";
import { DealTeamSection } from "@/components/pipelines/deal-team-section";
import { OpportunityIntelligencePanel } from "@/components/opportunity/opportunity-intelligence-panel";
import type { DealCommercialBaselineView } from "@/lib/commercial-baseline-engine";
import { getActivitiesForDeal } from "@/lib/activity-utils";

type DealDetailPanelProps = {
  pipeline: PipelineRow;
  activities: Activity[];
  companies: Company[];
  allPipelines: PipelineRow[];
  initialTab?: string;
  highlightPackageId?: string;
  dealTeam?: {
    team: PipelineTeamMember[];
    onAssign: (contactId: string, projectRole: string) => Promise<void>;
    readOnly?: boolean;
  };
  documents?: {
    readOnly?: boolean;
    onDocumentCreated?: (record: SmartDocLibraryRecord) => void;
  };
};

export function DealDetailPanel({
  pipeline,
  activities,
  companies,
  allPipelines,
  initialTab = "intelligence",
  highlightPackageId,
  dealTeam,
  documents,
}: DealDetailPanelProps) {
  const [tab, setTab] = useState(initialTab);
  const [commercialView, setCommercialView] = useState<DealCommercialBaselineView | null>(
    null,
  );
  const [commercialLoading, setCommercialLoading] = useState(false);

  const dealActivities = useMemo(
    () => getActivitiesForDeal(activities, pipeline.id),
    [activities, pipeline.id],
  );

  const hasLinkedDocument = Boolean(pipeline.FileLeafRef?.trim());

  useEffect(() => {
    if (tab !== "commercial") return;

    let cancelled = false;
    setCommercialLoading(true);

    void fetch(`/api/deals/${encodeURIComponent(pipeline.id)}/commercial-baseline`)
      .then((response) => response.json())
      .then((body: DealCommercialBaselineView) => {
        if (!cancelled) setCommercialView(body);
      })
      .finally(() => {
        if (!cancelled) setCommercialLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [pipeline.id, tab]);

  return (
    <div className="flex flex-col gap-3">
      {dealTeam && tab === "overview" ? (
        <DealTeamSection
          team={dealTeam.team}
          companies={companies}
          onAssign={dealTeam.onAssign}
          readOnly={dealTeam.readOnly}
        />
      ) : null}

      {hasLinkedDocument && tab !== "documents" ? (
        <button
          type="button"
          onClick={() => setTab("documents")}
          className="truncate border border-carbon-blue/10 bg-carbon-blue/[0.02] px-3 py-2 text-left text-[10px] text-carbon-blue hover:border-upcycle-orange/30"
        >
          <span className="font-semibold text-upcycle-orange">Documents</span>
          <span className="text-carbon-blue/45"> · {pipeline.FileLeafRef}</span>
        </button>
      ) : null}

      <EntityTabBar
        tabs={[
          { id: "intelligence", label: "Intelligence" },
          { id: "commercial", label: "Commercial" },
          { id: "documents", label: "Documents" },
          { id: "overview", label: "Overview" },
          { id: "activities", label: "Activities" },
        ]}
        active={tab}
        onChange={setTab}
      />

      <Link
        href={`/deals/${encodeURIComponent(pipeline.id)}`}
        className="text-[10px] text-carbon-blue/45 hover:text-upcycle-orange hover:underline"
      >
        Open full Deal 360
      </Link>

      {tab === "intelligence" ? (
        <OpportunityIntelligencePanel
          pipeline={pipeline}
          companies={companies}
          activities={activities}
          allPipelines={allPipelines}
        />
      ) : null}
      {tab === "commercial" ? (
        commercialLoading || !commercialView ? (
          <p className="text-[11px] text-carbon-blue/50">Loading commercial baseline…</p>
        ) : (
          <DealCommercialBaselinePanel
            view={commercialView}
            onViewChange={setCommercialView}
            highlightPackageId={highlightPackageId}
          />
        )
      ) : null}
      {tab === "documents" ? (
        <DealDocumentsPanel
          dealId={pipeline.id}
          readOnly={documents?.readOnly}
          onDocumentCreated={documents?.onDocumentCreated}
        />
      ) : null}
      {tab === "overview" ? <PipelineDetail pipeline={pipeline} /> : null}
      {tab === "activities" ? (
        <ActivityTimeline
          activities={dealActivities}
          emptyMessage="No activity history for this deal yet."
        />
      ) : null}
    </div>
  );
}
