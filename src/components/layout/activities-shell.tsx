"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ActivityCalendar } from "@/components/calendar/activity-calendar";
import { SmartActivityWorkspace } from "@/components/activities/smart-activity-workspace";
import { WorkspaceChrome } from "@/components/layout/workspace-chrome";
import { WorkspaceMain, WorkspaceStack } from "@/components/ui/workspace-main";
import { WorkspacePageTitle } from "@/components/ui/workspace-page-title";
import { WorkspaceTopBar } from "@/components/ui/workspace-top-bar";
import { cn } from "@/lib/cn";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type { Activity } from "@/types/activity";
import type { SyncedMailSummary } from "@/lib/email-intelligence-data";
import type { StandardBioUserRecord } from "@/types/user-access";

type ActivitiesShellProps = {
  activities: Activity[];
  companies: Company[];
  pipelines: PipelineRow[];
  assignableUsers?: StandardBioUserRecord[];
  syncedMail?: SyncedMailSummary;
};

type ActivitiesMode = "work" | "calendar";

const MODES: { id: ActivitiesMode; label: string; hint: string }[] = [
  { id: "work", label: "Work", hint: "Meetings, calls, and tasks — what is planned, what is overdue, and what needs attention." },
  { id: "calendar", label: "Calendar", hint: "Meetings, visits, and events by day." },
];

function readMode(value: string | null): ActivitiesMode {
  return value === "calendar" ? "calendar" : "work";
}

export function ActivitiesShell({
  activities,
  companies,
  pipelines,
  assignableUsers = [],
  syncedMail,
}: ActivitiesShellProps) {
  const searchParams = useSearchParams();
  const mode = readMode(searchParams.get("mode"));
  const active = MODES.find((item) => item.id === mode) ?? MODES[0]!;

  const hrefFor = (target: ActivitiesMode) => {
    const params = new URLSearchParams(searchParams.toString());
    if (target === "work") params.delete("mode");
    else params.set("mode", target);
    const qs = params.toString();
    return qs ? `/activities?${qs}` : "/activities";
  };

  return (
    <WorkspaceChrome>
      <WorkspaceTopBar icon="activity" title="Activities">
        <nav aria-label="Activities view" className="inline-flex border border-carbon-blue/12 bg-white">
          {MODES.map((item) => (
            <Link
              key={item.id}
              href={hrefFor(item.id)}
              aria-current={mode === item.id ? "page" : undefined}
              className={cn(
                "px-3 py-1 text-[13px] transition-colors",
                mode === item.id
                  ? "bg-carbon-blue text-white"
                  : "text-carbon-blue/65 hover:bg-carbon-blue/[0.04] hover:text-carbon-blue",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </WorkspaceTopBar>

      {mode === "calendar" ? (
        <ActivityCalendar />
      ) : (
        <WorkspaceMain>
          <WorkspaceStack>
            <WorkspacePageTitle icon="activity" title="Activities" subtitle={active.hint} />
            <SmartActivityWorkspace
              activities={activities}
              companies={companies}
              pipelines={pipelines}
              assignableUsers={assignableUsers}
              syncedMail={syncedMail}
              variant="page"
            />
          </WorkspaceStack>
        </WorkspaceMain>
      )}
    </WorkspaceChrome>
  );
}
