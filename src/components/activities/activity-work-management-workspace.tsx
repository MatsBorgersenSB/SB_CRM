"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChartGantt, List, Plus } from "lucide-react";
import { ActivityCalendarView } from "@/components/activities/activity-calendar-view";
import { ActivityCreateWizard } from "@/components/activities/activity-create-wizard";
import { ActivityGanttView } from "@/components/activities/activity-gantt-view";
import { TaskCreateModal } from "@/components/activities/task-create-modal";
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
import type { ActivityScheduleViewMode } from "@/lib/activity-schedule-views";
import { mergeStandardBioUserOptions } from "@/lib/standard-bio-users";
import { syncActivityUpdate } from "@/lib/sync-activity";
import type { FilterSummaryChip } from "@/types/workspace-filters";
import { EDITORIAL_GAP_BLOCK } from "@/lib/editorial-design-system";
import type { Company, SharePointPerson } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type { Activity } from "@/types/activity";
import type { StandardBioUserRecord } from "@/types/user-access";

const VIEW_MODES: Array<{
  id: ActivityScheduleViewMode;
  label: string;
  icon: typeof List;
}> = [
  { id: "list", label: "List", icon: List },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "gantt", label: "Gantt", icon: ChartGantt },
];

export function ActivityWorkManagementWorkspace({
  activities: initialActivities,
  companies,
  pipelines,
  assignableUsers = [],
  onActivitiesChange,
}: {
  activities: Activity[];
  companies: Company[];
  pipelines: PipelineRow[];
  assignableUsers?: StandardBioUserRecord[];
  onActivitiesChange?: () => void;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [activities, setActivities] = useState(initialActivities);
  const [filter, setFilter] = useState<ActivityWorkFilter>("my_tasks");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ActivityScheduleViewMode>("list");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);

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
    let rows = filterActivityRows(allRows, filter, user.displayName);
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
        row.activity.ActivityOwner?.Title,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [allRows, filter, search, user.displayName]);

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

  const assigneeOptions = useMemo(
    () =>
      mergeStandardBioUserOptions(assignableUsers, [
        { Id: user.id, Title: user.displayName },
      ]),
    [assignableUsers, user.id, user.displayName],
  );

  const currentUserPerson = useMemo(
    () => ({ Id: user.id, Title: user.displayName }),
    [user.id, user.displayName],
  );

  const handleSharedWithChange = useCallback(
    async (activity: Activity, sharedWith: SharePointPerson[]) => {
      await syncActivityUpdate(activity.ActivityID, { SharedWith: sharedWith });
      refreshActivities();
    },
    [refreshActivities],
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
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTaskOpen(true)}
            className="inline-flex items-center gap-1.5 border border-carbon-blue/15 bg-white px-3 py-1.5 text-[11px] font-semibold text-carbon-blue transition-colors hover:border-upcycle-orange hover:text-upcycle-orange"
          >
            <Plus className="size-3.5" strokeWidth={2} />
            New Task
          </button>
          <button
            type="button"
            onClick={() => setWizardOpen(true)}
            className="inline-flex items-center gap-1.5 border border-upcycle-orange/30 bg-upcycle-orange px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-upcycle-orange/90"
          >
            <Plus className="size-3.5" strokeWidth={2} />
            New Activity
          </button>
        </div>
      </div>

      <div className={`${WORKSPACE_PANEL_SURFACE} overflow-hidden p-0`}>
        <div className="border-b border-carbon-blue/8 px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <ActivitySmartFilters
                active={filter}
                onChange={setFilter}
                rows={allRows}
                currentUserName={user.displayName}
                search={search}
                onSearchChange={setSearch}
              />
            </div>
            <div
              className="flex shrink-0 items-center self-start border border-carbon-blue/10"
              role="group"
              aria-label="Presentation"
            >
              {VIEW_MODES.map((mode, index) => {
                const Icon = mode.icon;
                const active = viewMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setViewMode(mode.id)}
                    aria-label={`${mode.label} view`}
                    aria-pressed={active}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${
                      index > 0 ? "border-l border-carbon-blue/10" : ""
                    } ${
                      active
                        ? "bg-upcycle-orange/10 text-upcycle-orange"
                        : "text-carbon-blue/45 hover:text-carbon-blue"
                    }`}
                  >
                    <Icon className="size-3" strokeWidth={2} />
                    {mode.label}
                  </button>
                );
              })}
            </div>
          </div>
          <FilterTransparencyBar
            entityLabel="Activities"
            filteredCount={filteredRows.length}
            totalCount={allRows.length}
            activeFilters={activeFilterChips}
            onClearAll={activeFilterChips.length > 0 ? handleClearAllFilters : undefined}
            className="mt-3 border border-carbon-blue/10"
          />
        </div>

        {viewMode === "list" ? (
          <ActivityIntelligentTable
            rows={filteredRows}
            primaryFocusActivityId={primaryFocusActivityId}
            onOpen={openActivity}
            embedded
            assigneeOptions={assigneeOptions}
            currentUser={currentUserPerson}
            onSharedWithChange={handleSharedWithChange}
          />
        ) : null}

        {viewMode === "calendar" ? (
          <ActivityCalendarView
            rows={filteredRows}
            primaryFocusActivityId={primaryFocusActivityId}
            onOpen={openActivity}
          />
        ) : null}

        {viewMode === "gantt" ? (
          <ActivityGanttView
            rows={filteredRows}
            primaryFocusActivityId={primaryFocusActivityId}
            onOpen={openActivity}
          />
        ) : null}
      </div>

      <ActivityCreateWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={refreshActivities}
        companies={companies}
        pipelines={pipelines}
        defaultOwner={user}
        assignableUsers={assignableUsers}
      />

      <TaskCreateModal
        open={taskOpen}
        onClose={() => setTaskOpen(false)}
        onCreated={refreshActivities}
        companies={companies}
        pipelines={pipelines}
        assignableUsers={assignableUsers}
        defaultOwner={user}
      />
    </div>
  );
}
