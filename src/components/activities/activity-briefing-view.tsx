"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Activity } from "@/types/activity";
import type { CommercialPackage } from "@/types/commercial-package";
import type { Company, SharePointPerson } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type { SmartDocLibraryRecord } from "@/types/smartdoc-library";
import type { StandardBioUserRecord } from "@/types/user-access";
import type { ActivityRecommendedActionType } from "@/types/activity-action-recommendations";
import { ActivityActionRecommendationsPanel } from "@/components/activities/activity-action-recommendations";
import { ActivityWorkspaceContextSidebar } from "@/components/activities/activity-workspace-context-sidebar";
import { ActivityWorkspaceRecord } from "@/components/activities/activity-workspace-record";
import { TaskShareControl } from "@/components/activities/task-share-control";
import { WorkspaceIntelContextLayout } from "@/components/ui/workspace-intel-context-layout";
import { useAuth } from "@/context/auth-context";
import {
  buildActivityActionRecommendations,
  buildActivityActionRecommendationsForType,
} from "@/lib/activity-action-recommendations";
import { buildActivityActionContext } from "@/lib/activity-action-context";
import {
  briefingHasSupportContent,
  buildActivityBriefing,
  type ActivityBriefing,
} from "@/lib/activity-briefing";
import {
  EDITORIAL_GAP_BLOCK,
  EDITORIAL_HERO,
  EDITORIAL_LABEL,
  EDITORIAL_META,
} from "@/lib/editorial-design-system";
import { mergeStandardBioUserOptions } from "@/lib/standard-bio-users";
import { syncActivityUpdate } from "@/lib/sync-activity";
import {
  WORKSPACE_INTEL_METRICS_GRID,
  WORKSPACE_PANEL_SURFACE,
  WORKSPACE_SURFACE,
} from "@/lib/workspace-design-system";

const BUSINESS_STATE_STYLES = {
  overdue: "text-thermal-red/90",
  due_today: "text-upcycle-orange/90",
  waiting: "text-upcycle-orange/80",
  in_progress: "text-carbon-blue/70",
  requires_attention: "text-upcycle-orange/90",
  on_track: "text-carbon-blue/55",
  completed: "text-carbon-blue/45",
  cancelled: "text-carbon-blue/40",
} as const;

export function ActivityBriefingView({
  activity: activityProp,
  companies,
  pipelines,
  allActivities,
  smartDocsLibrary,
  commercialPackages,
  assignableUsers = [],
  onEdit,
}: {
  activity: Activity;
  companies: Company[];
  pipelines: PipelineRow[];
  allActivities: Activity[];
  smartDocsLibrary: SmartDocLibraryRecord[];
  commercialPackages: CommercialPackage[];
  assignableUsers?: StandardBioUserRecord[];
  onEdit?: () => void;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [activity, setActivity] = useState(activityProp);

  useEffect(() => {
    setActivity(activityProp);
  }, [activityProp]);

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
    async (sharedWith: SharePointPerson[]) => {
      const updated = await syncActivityUpdate(activity.ActivityID, {
        SharedWith: sharedWith,
      });
      setActivity(updated);
      router.refresh();
    },
    [activity.ActivityID, router],
  );

  const briefing = buildActivityBriefing(activity, pipelines, companies, allActivities);
  const hasRecord = briefingHasSupportContent(briefing.support);
  const isTask = activity.ActivityType === "Task";

  return (
    <div className={`${WORKSPACE_SURFACE} ${EDITORIAL_GAP_BLOCK}`}>
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/activities"
          className="text-[11px] font-medium text-carbon-blue/45 transition-colors hover:text-upcycle-orange"
        >
          ← Activities
        </Link>
        <div className="flex items-center gap-3">
          {isTask && assigneeOptions.length > 0 ? (
            <TaskShareControl
              activity={activity}
              options={assigneeOptions}
              currentUser={currentUserPerson}
              onSharedWithChange={handleSharedWithChange}
            />
          ) : null}
          {onEdit ? (
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-carbon-blue/45 transition-colors hover:text-carbon-blue"
            >
              <Pencil className="size-3" strokeWidth={2} />
              Edit
            </button>
          ) : null}
        </div>
      </div>

      <ActivityWorkspace
        activity={activity}
        briefing={briefing}
        companies={companies}
        pipelines={pipelines}
        allActivities={allActivities}
        smartDocsLibrary={smartDocsLibrary}
        commercialPackages={commercialPackages}
        hasRecord={hasRecord}
      />
    </div>
  );
}

function ActivityWorkspace({
  activity,
  briefing,
  companies,
  pipelines,
  allActivities,
  smartDocsLibrary,
  commercialPackages,
  hasRecord,
}: {
  activity: Activity;
  briefing: ActivityBriefing;
  companies: Company[];
  pipelines: PipelineRow[];
  allActivities: Activity[];
  smartDocsLibrary: SmartDocLibraryRecord[];
  commercialPackages: CommercialPackage[];
  hasRecord: boolean;
}) {
  const [selectedActionType, setSelectedActionType] =
    useState<ActivityRecommendedActionType | null>(null);

  const recommendations = useMemo(() => {
    if (selectedActionType) {
      return buildActivityActionRecommendationsForType(
        activity,
        briefing,
        companies,
        pipelines,
        selectedActionType,
      );
    }
    return buildActivityActionRecommendations(activity, briefing, companies, pipelines);
  }, [activity, briefing, companies, pipelines, selectedActionType]);

  const actionContext = useMemo(
    () =>
      buildActivityActionContext({
        activity,
        briefing,
        recommendations,
        companies,
        pipelines,
        allActivities,
        smartDocsLibrary,
        commercialPackages,
      }),
    [
      activity,
      briefing,
      recommendations,
      companies,
      pipelines,
      allActivities,
      smartDocsLibrary,
      commercialPackages,
    ],
  );

  const relatedActivities = allActivities.filter((item) =>
    briefing.support.relatedActivityIds.includes(item.ActivityID),
  );

  const showActions = activity.ActionStatus !== "Cancelled";

  return (
    <WorkspaceIntelContextLayout
      header={
        <header className="border-b border-carbon-blue/8 pb-6">
          <p className={EDITORIAL_META}>
            <span className="font-medium text-carbon-blue/55">{briefing.documentLabel}</span>
            <span className="mx-1.5 text-carbon-blue/20">·</span>
            {briefing.activityType}
            <span className="mx-1.5 text-carbon-blue/20">·</span>
            {briefing.occurredAt}
            <span className="mx-1.5 text-carbon-blue/20">·</span>
            <span className={BUSINESS_STATE_STYLES[briefing.businessState]}>
              {briefing.businessStateLabel}
            </span>
            {briefing.timingLabel ? (
              <>
                <span className="mx-1.5 text-carbon-blue/20">·</span>
                {briefing.timingLabel}
              </>
            ) : null}
            <span className="mx-1.5 text-carbon-blue/20">·</span>
            <span className="font-mono">{briefing.activityId}</span>
          </p>

          <h1 className={`mt-3 ${EDITORIAL_HERO}`}>{briefing.name}</h1>

          <p className={`mt-2 ${EDITORIAL_META}`}>
            <span className="text-carbon-blue/40">Regarding </span>
            <ContextLinks briefing={briefing} />
          </p>
          {activity.ActivityType === "Task" && (activity.SharedWith?.length ?? 0) > 0 ? (
            <p className={`mt-2 ${EDITORIAL_META}`}>
              <span className="text-carbon-blue/40">Shared with </span>
              {activity.SharedWith!.map((person) => person.Title).join(", ")}
            </p>
          ) : null}
        </header>
      }
      intelligence={
        <IntelligencePanel
          briefing={briefing}
          expectedOutcome={recommendations.primary.expectedOutcome}
          showOutcome={showActions}
        />
      }
      actions={
        showActions ? (
          <ActivityActionRecommendationsPanel
            activity={activity}
            briefing={briefing}
            companies={companies}
            pipelines={pipelines}
            selectedType={selectedActionType}
            onSelectedTypeChange={setSelectedActionType}
          />
        ) : null
      }
      context={<ActivityWorkspaceContextSidebar context={actionContext} />}
      footer={
        <ActivityWorkspaceRecord
          activity={activity}
          briefing={briefing}
          relatedActivities={relatedActivities}
          hasRecord={hasRecord}
        />
      }
    />
  );
}

function IntelligencePanel({
  briefing,
  expectedOutcome,
  showOutcome,
}: {
  briefing: ActivityBriefing;
  expectedOutcome: string;
  showOutcome: boolean;
}) {
  return (
    <section className={WORKSPACE_PANEL_SURFACE}>
      <div
        className={`rounded-md border px-4 py-4 xl:px-5 xl:py-5 ${
          briefing.requiresAttention
            ? "border-upcycle-orange/25 bg-upcycle-orange/[0.04]"
            : "border-carbon-blue/10 bg-carbon-blue/[0.02]"
        }`}
      >
        <p className={EDITORIAL_LABEL}>Next best action</p>
        <p className="mt-2 text-[18px] font-semibold leading-snug text-carbon-blue xl:text-[19px]">
          {briefing.nextStep}
          {briefing.nextStepDue ? (
            <span className="ml-2 text-[15px] font-normal text-carbon-blue/50">
              · Due {briefing.nextStepDue}
            </span>
          ) : null}
        </p>
      </div>

      <div className={`mt-5 ${WORKSPACE_INTEL_METRICS_GRID}`}>
        <IntelCell label="Why it matters" value={briefing.whyItMatters} />
        <IntelCell label="Blocking progress" value={briefing.blockingProgress} />
        {showOutcome ? <IntelCell label="Expected outcome" value={expectedOutcome} /> : null}
      </div>
    </section>
  );
}

function IntelCell({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className={EDITORIAL_LABEL}>{label}</p>
      <p className={`mt-1.5 text-[14px] leading-[1.55] text-carbon-blue/85`}>{value}</p>
    </div>
  );
}

function ContextLinks({ briefing }: { briefing: ActivityBriefing }) {
  const { context } = briefing;
  const items: ReactNode[] = [];

  if (context.companyName && context.companyHref) {
    items.push(
      <Link key="company" href={context.companyHref} className="hover:text-upcycle-orange">
        {context.companyName}
      </Link>,
    );
  } else if (context.companyName) {
    items.push(<span key="company">{context.companyName}</span>);
  }

  if (context.contactName) {
    items.push(<span key="contact">{context.contactName}</span>);
  }

  if (context.dealName && context.dealHref) {
    items.push(
      <Link key="deal" href={context.dealHref} className="hover:text-upcycle-orange">
        {context.dealName}
      </Link>,
    );
  } else if (context.dealName) {
    items.push(<span key="deal">{context.dealName}</span>);
  }

  if (items.length === 0) {
    return <span>this engagement</span>;
  }

  return (
    <>
      {items.map((item, index) => (
        <span key={index}>
          {index > 0 ? <span className="mx-1 text-carbon-blue/25">·</span> : null}
          {item}
        </span>
      ))}
    </>
  );
}
