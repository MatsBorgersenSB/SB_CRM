"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Plus } from "lucide-react";
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
import { mergeStandardBioUserOptions } from "@/lib/standard-bio-users";
import { syncActivityUpdate } from "@/lib/sync-activity";
import type { FilterSummaryChip } from "@/types/workspace-filters";
import { EDITORIAL_GAP_BLOCK } from "@/lib/editorial-design-system";
import type { Company, SharePointPerson } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type { Activity } from "@/types/activity";
import type { StandardBioUserRecord } from "@/types/user-access";
import type { SyncedMailSummary } from "@/lib/email-intelligence-data";

const NEW_BUTTON_CLASS =
  "inline-flex items-center gap-1.5 border border-upcycle-orange/30 bg-upcycle-orange px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-upcycle-orange/90";

export function ActivityWorkManagementWorkspace({
  activities: initialActivities,
  companies,
  pipelines,
  assignableUsers = [],
  onActivitiesChange,
  syncedMail,
}: {
  activities: Activity[];
  companies: Company[];
  pipelines: PipelineRow[];
  assignableUsers?: StandardBioUserRecord[];
  onActivitiesChange?: () => void;
  syncedMail?: SyncedMailSummary;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [activities, setActivities] = useState(initialActivities);
  const [syncedFrom, setSyncedFrom] = useState(initialActivities);
  const [filter, setFilter] = useState<ActivityWorkFilter>("my_tasks");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  // Server data wins whenever the page refreshes (derived during render, no effect).
  if (syncedFrom !== initialActivities) {
    setSyncedFrom(initialActivities);
    setActivities(initialActivities);
  }

  const allRows = useMemo(
    () => buildActivityIntelligentRows(activities, pipelines),
    [activities, pipelines],
  );

  const mission = useMemo(
    () => buildActivityMissionControl(activities, pipelines),
    [activities, pipelines],
  );

  const filteredRows = useMemo(() => {
    const rows = filterActivityRows(allRows, filter, user.displayName);
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

  const handleAssigneeChange = useCallback(
    async (activity: Activity, assignee: SharePointPerson) => {
      const sharedWith = (activity.SharedWith ?? []).filter(
        (person) => person.Id !== assignee.Id,
      );
      setActivities((current) =>
        current.map((item) =>
          item.ActivityID === activity.ActivityID
            ? { ...item, ActivityOwner: assignee, SharedWith: sharedWith }
            : item,
        ),
      );
      await syncActivityUpdate(activity.ActivityID, {
        ActivityOwner: assignee,
        SharedWith: sharedWith,
      });
      refreshActivities();
    },
    [refreshActivities],
  );

  const isEmpty = allRows.length === 0;

  return (
    <div className={`flex flex-col ${EDITORIAL_GAP_BLOCK}`}>
      {isEmpty ? (
        <EmptyActivities onNew={() => setCreateOpen(true)} syncedMail={syncedMail} />
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold leading-snug tracking-tight text-carbon-blue">
                {mission.attention.headline}
              </h2>
              <p className="mt-1 text-[13px] text-carbon-blue/55">{mission.attention.subline}</p>
            </div>
            <button type="button" onClick={() => setCreateOpen(true)} className={NEW_BUTTON_CLASS}>
              <Plus className="size-3.5" strokeWidth={2} />
              New
            </button>
          </div>

          <div className={`${WORKSPACE_PANEL_SURFACE} overflow-hidden p-0`}>
            <div className="border-b border-carbon-blue/8 px-4 py-4 sm:px-5">
              <ActivitySmartFilters
                active={filter}
                onChange={setFilter}
                rows={allRows}
                currentUserName={user.displayName}
                search={search}
                onSearchChange={setSearch}
              />
              {activeFilterChips.length > 0 ? (
                <FilterTransparencyBar
                  entityLabel="Activities"
                  filteredCount={filteredRows.length}
                  totalCount={allRows.length}
                  activeFilters={activeFilterChips}
                  onClearAll={handleClearAllFilters}
                  className="mt-3 border border-carbon-blue/10"
                />
              ) : null}
            </div>

            <ActivityIntelligentTable
              rows={filteredRows}
              primaryFocusActivityId={primaryFocusActivityId}
              onOpen={openActivity}
              embedded
              assigneeOptions={assigneeOptions}
              onAssigneeChange={handleAssigneeChange}
            />
          </div>
        </>
      )}

      <ActivityCreateWizard
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={refreshActivities}
        companies={companies}
        pipelines={pipelines}
        defaultOwner={user}
        assignableUsers={assignableUsers}
      />
    </div>
  );
}

/**
 * Nothing planned yet: one thing to do, nothing to filter. If Outlook mail
 * has been synced, say so — the relationship record is not empty, only the
 * plan is.
 */
function EmptyActivities({
  onNew,
  syncedMail,
}: {
  onNew: () => void;
  syncedMail?: SyncedMailSummary;
}) {
  const mailCount = syncedMail?.messageCount ?? 0;
  const latestMail = syncedMail?.latestSentAt
    ? new Date(syncedMail.latestSentAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        // Fixed zone: server (UTC) and browser must agree on the day, or hydration mismatches near midnight.
        timeZone: "Europe/Oslo",
      })
    : null;

  return (
    <section className={`${WORKSPACE_PANEL_SURFACE} flex flex-col items-start gap-4 px-6 py-10 sm:px-8`}>
      <div className="max-w-xl">
        <h2 className="text-lg font-semibold leading-snug tracking-tight text-carbon-blue">
          Nothing planned yet
        </h2>
        {mailCount > 0 ? (
          <p className="mt-2 text-sm leading-relaxed text-carbon-blue/70">
            SmartCRM is already following your Outlook mail — {mailCount.toLocaleString("en-GB")}{" "}
            message{mailCount === 1 ? "" : "s"}
            {latestMail ? `, the latest from ${latestMail}` : ""}. You can see them on each company
            and person. What is missing here is the plan: meetings, calls, and tasks you intend to
            do.
          </p>
        ) : (
          <p className="mt-2 text-sm leading-relaxed text-carbon-blue/70">
            Plan a meeting, a call, or a task — or paste a link to an event and SmartAssist will
            read the name, dates and place for you. Everything you add shows up here and on the
            calendar.
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={onNew} className={NEW_BUTTON_CLASS}>
          <Plus className="size-3.5" strokeWidth={2} />
          Plan your first activity
        </button>
        <Link
          href="/activities?mode=calendar"
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-carbon-blue/55 hover:text-carbon-blue"
        >
          <CalendarDays className="size-3.5" strokeWidth={2} />
          Open the calendar
        </Link>
      </div>
    </section>
  );
}
