"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { ActivityCreateWizard } from "@/components/activities/activity-create-wizard";
import { ActivityIntelligentTable } from "@/components/activities/activity-intelligent-table";
import { ActivitySmartFilters } from "@/components/activities/activity-smart-filters";
import { FilterTransparencyBar } from "@/components/ui/filter-transparency-bar";
import { WORKSPACE_PANEL_SURFACE } from "@/lib/workspace-design-system";
import { useAuth } from "@/context/auth-context";
import {
  ACTIVITY_WORK_FILTERS,
  buildActivityIntelligentRows,
  buildActivityMissionControl,
  filterActivityRows,
  type ActivityWorkFilter,
} from "@/lib/activity-mission-control";
import type { FilterSummaryChip } from "@/types/workspace-filters";
import { EDITORIAL_GAP_BLOCK } from "@/lib/editorial-design-system";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type { Activity } from "@/types/activity";

export function ActivityWorkManagementWorkspace({
  activities: initialActivities,
  companies,
  pipelines,
  onActivitiesChange,
}: {
  activities: Activity[];
  companies: Company[];
  pipelines: PipelineRow[];
  onActivitiesChange?: () => void;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [activities, setActivities] = useState(initialActivities);
  const [filter, setFilter] = useState<ActivityWorkFilter>("all");
  const [search, setSearch] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);

  useEffect(() => {
    setActivities(initialActivities);
  }, [initialActivities]);

  const allRows = useMemo(
    () => buildActivityIntelligentRows(activities, pipelines),
    [activities, pipelines],
  );

  const mission = useMemo(
    () => buildActivityMissionControl(activities, pipelines),
    [activities, pipelines],
  );

  const filteredRows = useMemo(() => {
    let rows = filterActivityRows(allRows, filter);
    const query = search.trim().toLowerCase();
    if (!query) return rows;

    return rows.filter((row) => {
      const haystack = [
        row.headline,
        row.whyItMatters,
        row.blockingProgress,
        row.recommendedAction,
        row.companyLabel,
        row.dealLabel,
        row.activity.ActivityType,
        row.activity.NextAction,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [allRows, filter, search]);

  const primaryFocusActivityId =
    filteredRows.find((row) => row.requiresAttention)?.id ??
    filteredRows[0]?.id ??
    null;

  const activeFilterChips = useMemo(() => {
    const chips: FilterSummaryChip[] = [];
    if (filter !== "all") {
      const label = ACTIVITY_WORK_FILTERS.find((entry) => entry.id === filter)?.label ?? filter;
      chips.push({
        id: "view",
        label: "View",
        value: label,
        onRemove: () => setFilter("all"),
      });
    }
    const query = search.trim();
    if (query) {
      chips.push({
        id: "search",
        label: "Search",
        value: query,
        onRemove: () => setSearch(""),
      });
    }
    return chips;
  }, [filter, search]);

  const handleClearAllFilters = useCallback(() => {
    setFilter("all");
    setSearch("");
  }, []);

  const refreshActivities = useCallback(() => {
    void fetch("/api/activities")
      .then((response) => response.json())
      .then((data: Activity[]) => setActivities(data));
    onActivitiesChange?.();
  }, [onActivitiesChange]);

  const openActivity = useCallback(
    (activityId: string) => {
      router.push(`/activities/${activityId}`);
    },
    [router],
  );

  return (
    <div className={`flex flex-col ${EDITORIAL_GAP_BLOCK}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-carbon-blue/45">Attention management</p>
          <h2 className="mt-1 text-lg font-semibold leading-snug tracking-tight text-carbon-blue">
            {mission.attention.headline}
          </h2>
          <p className="mt-1 text-[13px] text-carbon-blue/55">{mission.attention.subline}</p>
        </div>
        <button
          type="button"
          onClick={() => setWizardOpen(true)}
          className="inline-flex shrink-0 items-center gap-1.5 border border-upcycle-orange/30 bg-upcycle-orange px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-upcycle-orange/90"
        >
          <Plus className="size-3.5" strokeWidth={2} />
          New Activity
        </button>
      </div>

      <div className={`${WORKSPACE_PANEL_SURFACE} overflow-hidden p-0`}>
        <div className="border-b border-carbon-blue/8 px-4 py-4 sm:px-5">
          <ActivitySmartFilters
            active={filter}
            onChange={setFilter}
            rows={allRows}
            search={search}
            onSearchChange={setSearch}
          />
          <FilterTransparencyBar
            entityLabel="Activities"
            filteredCount={filteredRows.length}
            totalCount={allRows.length}
            activeFilters={activeFilterChips}
            onClearAll={activeFilterChips.length > 0 ? handleClearAllFilters : undefined}
            className="mt-3 border border-carbon-blue/10"
          />
        </div>
        <ActivityIntelligentTable
          rows={filteredRows}
          primaryFocusActivityId={primaryFocusActivityId}
          onOpen={openActivity}
          embedded
        />
      </div>

      <ActivityCreateWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={refreshActivities}
        companies={companies}
        pipelines={pipelines}
        defaultOwner={user}
      />
    </div>
  );
}
