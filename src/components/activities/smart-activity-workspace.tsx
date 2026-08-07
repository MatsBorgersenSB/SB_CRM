"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { ActivityCreateWizard } from "@/components/activities/activity-create-wizard";
import { ActivityWorkManagementWorkspace } from "@/components/activities/activity-work-management-workspace";
import { GenerateAiDraftControl } from "@/components/ai/generate-ai-draft-drawer";
import { FilterToolbar } from "@/components/ui/filter-toolbar";
import {
  ActivityPlanningRow,
  ActivityWorkspaceSection,
} from "@/components/activities/activity-planning-row";
import { ActivitySuggestedPanel } from "@/components/activities/activity-suggested-panel";
import { ActivityTimeline } from "@/components/activities/activity-timeline";
import { ActivityIntelligencePanel } from "@/components/activities/activity-intelligence";
import { useSmartAssistActionHost } from "@/components/smartassist/smartassist-action-host";
import { SmartAssistCopilotHost } from "@/components/smartassist/smart-assist-copilot-host";
import { useAuth } from "@/context/auth-context";
import { useWorkspaceFilterBridge } from "@/hooks/use-workspace-filter-bridge";
import {
  applyActivityQuickFilter,
  buildSuggestedActivities,
  filterActivitiesForWorkspace,
  partitionActivitiesForWorkspace,
} from "@/lib/activity-workspace";
import {
  consumeSmartAssistPrefill,
  prefillToCreateActivityInput,
} from "@/lib/smart-assist-prefill";
import { computeActivityIntelligence, getActivitiesForCompany, getActivitiesForContact, getActivitiesForDeal } from "@/lib/activity-utils";
import { syncActivityUpdate } from "@/lib/sync-activity";
import type { AttentionItem } from "@/types/attention-item";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type {
  ActionStatus,
  Activity,
  ActivityFilters,
  ActivityWorkspaceContext,
  CreateActivityInput,
} from "@/types/activity";
import {
  ACTIVITY_QUICK_FILTERS,
  ACTIVITY_TYPES,
  ACTION_STATUSES,
  EMPTY_ACTIVITY_FILTERS,
  type ActivityQuickFilter,
} from "@/types/activity";
import type { FilterDefinition } from "@/types/workspace-filters";
import { normalizeMultiFilter, normalizeSingleFilter } from "@/types/workspace-filters";

const ACTIVITY_FILTER_KEYS = ["view", "type", "status", "company"] as const;

type SmartActivityWorkspaceProps = {
  activities: Activity[];
  companies: Company[];
  pipelines: PipelineRow[];
  context?: ActivityWorkspaceContext;
  attentionItems?: AttentionItem[];
  variant?: "page" | "embedded";
  onActivitiesChange?: () => void;
};

function contextPreset(context?: ActivityWorkspaceContext): Partial<CreateActivityInput> {
  if (!context) return {};
  return {
    Company: context.companyId ? { CompanyID: context.companyId } : null,
    Contact: context.contactId ? { ContactID: context.contactId } : null,
    Deal: context.dealId ? { DealID: context.dealId } : null,
  };
}

export function SmartActivityWorkspace({
  activities: initialActivities,
  companies,
  pipelines,
  context,
  attentionItems = [],
  variant = "embedded",
  onActivitiesChange,
}: SmartActivityWorkspaceProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [activities, setActivities] = useState(initialActivities);
  const [filters, setFilters] = useState<ActivityFilters>(() => ({
    ...EMPTY_ACTIVITY_FILTERS,
    companyId: context?.companyId ?? "",
    contactId: context?.contactId ?? "",
    dealId: context?.dealId ?? "",
  }));
  const [owner, setOwner] = useState("all");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

  const applyBridge = useCallback(
    (patch: { filters?: Record<string, string | string[]>; search?: string; owner?: string }) => {
      if (patch.filters) {
        const view = normalizeSingleFilter(patch.filters.view, "all") as ActivityQuickFilter;
        const types = normalizeMultiFilter(patch.filters.type);
        const status = normalizeSingleFilter(patch.filters.status, "");
        const companyId = normalizeSingleFilter(patch.filters.company, "");
        setFilters((current) => ({
          ...current,
          quickFilter: view,
          status: status as ActivityFilters["status"],
          companyId: companyId || current.companyId,
        }));
        if (types.length > 0) setSelectedTypes(types);
      }
      if (patch.search !== undefined) {
        setFilters((current) => ({ ...current, search: patch.search ?? "" }));
      }
      if (patch.owner !== undefined) setOwner(patch.owner);
    },
    [],
  );

  useWorkspaceFilterBridge("activities", [...ACTIVITY_FILTER_KEYS], applyBridge);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardPreset, setWizardPreset] = useState<Partial<CreateActivityInput>>(
    contextPreset(context),
  );

  useEffect(() => {
    setActivities(initialActivities);
  }, [initialActivities]);

  useEffect(() => {
    const prefill = consumeSmartAssistPrefill();
    if (!prefill) return;
    setWizardPreset((current) => ({
      ...contextPreset(context),
      ...current,
      ...prefillToCreateActivityInput(prefill),
    }));
    setWizardOpen(true);
  }, [context]);

  const scopeActivities = useCallback(
    (rows: Activity[]) => {
      if (context?.dealId) return getActivitiesForDeal(rows, context.dealId);
      if (context?.contactId) return getActivitiesForContact(rows, context.contactId);
      if (context?.companyId) {
        const company = companies.find((c) => c.CompanyID === context.companyId);
        if (company) return getActivitiesForCompany(rows, company);
      }
      return rows;
    },
    [context, companies],
  );

  const quickFilterCounts = useMemo(() => {
    const scoped = filterActivitiesForWorkspace(
      activities,
      { ...filters, quickFilter: "all" },
      companies,
      user.displayName,
    );
    return {
      all: scoped.length,
      mine: applyActivityQuickFilter(scoped, "mine", user.displayName).length,
      planned: applyActivityQuickFilter(scoped, "planned", user.displayName).length,
      overdue: applyActivityQuickFilter(scoped, "overdue", user.displayName).length,
      completed: applyActivityQuickFilter(scoped, "completed", user.displayName).length,
      this_week: applyActivityQuickFilter(scoped, "this_week", user.displayName).length,
      needs_attention: applyActivityQuickFilter(scoped, "needs_attention", user.displayName)
        .length,
      meetings: applyActivityQuickFilter(scoped, "meetings", user.displayName).length,
      calls: applyActivityQuickFilter(scoped, "calls", user.displayName).length,
      tasks: applyActivityQuickFilter(scoped, "tasks", user.displayName).length,
    };
  }, [activities, filters, companies, user.displayName]);

  const filtered = useMemo(() => {
    let rows = filterActivitiesForWorkspace(activities, filters, companies, user.displayName);
    if (selectedTypes.length > 0) {
      rows = rows.filter((activity) => selectedTypes.includes(activity.ActivityType));
    }
    if (owner !== "all") {
      rows = rows.filter(
        (activity) => activity.ActivityOwner?.Title?.toLowerCase() === owner.toLowerCase(),
      );
    }
    return rows;
  }, [activities, filters, companies, user.displayName, owner, selectedTypes]);

  const ownerOptions = useMemo(() => {
    const labels = new Set<string>();
    for (const activity of activities) {
      if (activity.ActivityOwner?.Title) labels.add(activity.ActivityOwner.Title);
    }
    return Array.from(labels)
      .sort()
      .map((label) => ({ value: label, label }));
  }, [activities]);

  const activityFilterDefinitions = useMemo<FilterDefinition[]>(() => {
    const defs: FilterDefinition[] = [
      {
        id: "view",
        label: "View",
        mode: "single",
        emptyValue: "all",
        options: ACTIVITY_QUICK_FILTERS.map((item) => ({
          value: item.id,
          label: item.label,
          count: quickFilterCounts[item.id],
        })),
      },
      {
        id: "type",
        label: "Type",
        mode: "multi",
        options: ACTIVITY_TYPES.map((type) => ({ value: type, label: type })),
      },
      {
        id: "status",
        label: "Status",
        mode: "single",
        emptyValue: "",
        options: ACTION_STATUSES.map((status) => ({ value: status, label: status })),
      },
    ];
    if (!context?.companyId) {
      defs.push({
        id: "company",
        label: "Company",
        mode: "single",
        emptyValue: "",
        options: companies.map((company) => ({
          value: company.CompanyID,
          label: company.Title,
        })),
      });
    }
    return defs;
  }, [companies, context?.companyId, quickFilterCounts]);

  const toolbarValues = useMemo(
    () => ({
      view: filters.quickFilter,
      type: selectedTypes,
      status: filters.status,
      company: filters.companyId,
    }),
    [filters.quickFilter, filters.status, filters.companyId, selectedTypes],
  );

  const handleToolbarFilterChange = useCallback((id: string, value: string | string[]) => {
    if (id === "view") {
      setFilters((current) => ({
        ...current,
        quickFilter: normalizeSingleFilter(value, "all") as ActivityQuickFilter,
      }));
      return;
    }
    if (id === "type") {
      setSelectedTypes(normalizeMultiFilter(value));
      return;
    }
    if (id === "status") {
      setFilters((current) => ({
        ...current,
        status: normalizeSingleFilter(value, "") as ActivityFilters["status"],
      }));
      return;
    }
    if (id === "company") {
      setFilters((current) => ({
        ...current,
        companyId: normalizeSingleFilter(value, ""),
      }));
    }
  }, []);

  const partitions = useMemo(
    () => partitionActivitiesForWorkspace(filtered),
    [filtered],
  );

  const intelligence = useMemo(
    () => computeActivityIntelligence(filtered, pipelines),
    [filtered, pipelines],
  );

  const suggestions = useMemo(
    () =>
      buildSuggestedActivities(attentionItems, {
        companyId: context?.companyId,
        contactId: context?.contactId,
        dealId: context?.dealId,
        companyName: context?.companyName,
        contactName: context?.contactName,
      }),
    [attentionItems, context],
  );

  const refreshActivities = useCallback(() => {
    void fetch("/api/activities")
      .then((r) => r.json())
      .then((data: Activity[]) => setActivities(scopeActivities(data)));
    onActivitiesChange?.();
  }, [onActivitiesChange, scopeActivities]);

  const openWizard = useCallback(
    (preset?: Partial<CreateActivityInput>) => {
      setWizardPreset({ ...contextPreset(context), ...preset });
      setWizardOpen(true);
    },
    [context],
  );

  const { executeSuggestion, EmailAssistantModal } = useSmartAssistActionHost({
    ownerName: user.displayName,
    onOpenActivityWizard: openWizard,
  });

  const handleSelect = useCallback(
    (activity: Activity) => {
      router.push(`/activities/${activity.ActivityID}`);
    },
    [router],
  );

  const handleStatusChange = useCallback(
    async (activity: Activity, status: ActionStatus) => {
      await syncActivityUpdate(activity.ActivityID, { ActionStatus: status });
      refreshActivities();
    },
    [refreshActivities],
  );

  const scopedActivityCount = useMemo(
    () => scopeActivities(activities).length,
    [activities, scopeActivities],
  );

  const defaultToolbarValues = useMemo(
    () => ({
      view: "all",
      type: [] as string[],
      status: "",
      company: context?.companyId ?? "",
    }),
    [context?.companyId],
  );

  const handleClearAllFilters = useCallback(() => {
    setFilters({
      ...EMPTY_ACTIVITY_FILTERS,
      companyId: context?.companyId ?? "",
      contactId: context?.contactId ?? "",
      dealId: context?.dealId ?? "",
    });
    setSelectedTypes([]);
    setOwner("all");
  }, [context?.companyId, context?.contactId, context?.dealId]);

  const isPage = variant === "page";

  if (isPage) {
    return (
      <ActivityWorkManagementWorkspace
        activities={initialActivities}
        companies={companies}
        pipelines={pipelines}
        onActivitiesChange={onActivitiesChange}
      />
    );
  }

  return (
    <div className={`flex flex-col ${isPage ? "gap-6" : "gap-4"}`}>
      {isPage || context?.companyName ? (
        <SmartAssistCopilotHost companyName={context?.companyName} />
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <FilterToolbar
            filters={activityFilterDefinitions}
            values={toolbarValues}
            onChange={handleToolbarFilterChange}
            search={filters.search}
            onSearchChange={(search) => setFilters((current) => ({ ...current, search }))}
            searchPlaceholder="Search activities…"
            owners={ownerOptions}
            ownerValue={owner}
            onOwnerChange={setOwner}
            className="rounded-none border-x-0 border-t-0 px-0"
            entityLabel="Activities"
            totalCount={scopedActivityCount}
            filteredCount={filtered.length}
            defaultValues={defaultToolbarValues}
            onClearAll={handleClearAllFilters}
          />
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {context?.contactName || context?.dealName ? (
            <GenerateAiDraftControl
              draftContext={{
                contactName: context.contactName || "Stakeholder",
                companyName: context.companyName,
                dealStage: context.dealId
                  ? pipelines.find((row) => row.id === context.dealId)?.status
                  : undefined,
                dealId: context.dealId,
                contactId: context.contactId,
                context: [
                  context.dealName ? `Opportunity: ${context.dealName}` : null,
                  context.companyName ? `Company: ${context.companyName}` : null,
                  "Follow up on recent activity and confirm the next commercial step.",
                ]
                  .filter(Boolean)
                  .join(". "),
              }}
            />
          ) : null}
          <button
            type="button"
            onClick={() => openWizard()}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 border border-upcycle-orange/30 bg-upcycle-orange px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-upcycle-orange/90"
          >
            <Plus className="size-3.5" strokeWidth={2} />
            New Activity
          </button>
        </div>
      </div>

      {isPage ? <ActivityIntelligencePanel intelligence={intelligence} /> : null}

      <ActivitySuggestedPanel
        suggestions={suggestions}
        onExecuteSuggestion={executeSuggestion}
      />

      <div className={`grid gap-4 ${isPage ? "lg:grid-cols-2" : ""}`}>
        <ActivityWorkspaceSection
          title="Planning"
          count={partitions.planning.length}
          emptyMessage="No planned activities — create one to schedule the next touchpoint."
        >
          {partitions.planning.map((activity) => (
            <ActivityPlanningRow
              key={activity.ActivityID}
              activity={activity}
              onSelect={handleSelect}
              onStatusChange={handleStatusChange}
              compact={!isPage}
            />
          ))}
        </ActivityWorkspaceSection>

        <ActivityWorkspaceSection
          title="Execution"
          count={partitions.execution.length}
          emptyMessage="Nothing in progress — start a planned activity or log an interaction."
        >
          {partitions.execution.map((activity) => (
            <ActivityPlanningRow
              key={activity.ActivityID}
              activity={activity}
              onSelect={handleSelect}
              onStatusChange={handleStatusChange}
              compact={!isPage}
            />
          ))}
        </ActivityWorkspaceSection>
      </div>

      <ActivityWorkspaceSection
        title="History"
        count={partitions.history.length}
        emptyMessage="No activity history yet — the timeline becomes the memory of every relationship."
      >
        <ActivityTimeline
          activities={partitions.history}
          onSelect={handleSelect}
          compact={!isPage}
          emptyMessage=""
        />
      </ActivityWorkspaceSection>

      {isPage ? null : (
        <Link
          href="/activities"
          className="inline-block text-[10px] font-semibold text-upcycle-orange hover:underline"
        >
          Open full activity workspace →
        </Link>
      )}

      <ActivityCreateWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={refreshActivities}
        companies={companies}
        pipelines={pipelines}
        preset={wizardPreset}
        defaultOwner={user}
      />

      {EmailAssistantModal}
    </div>
  );
}
