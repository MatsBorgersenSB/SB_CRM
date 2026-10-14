"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ActivityCalendar } from "@/components/calendar/activity-calendar";
import { SmartActivityWorkspace } from "@/components/activities/smart-activity-workspace";
import { WorkspaceChrome } from "@/components/layout/workspace-chrome";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { WorkspaceMain } from "@/components/ui/workspace-main";
import { cn } from "@/lib/cn";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type { Activity } from "@/types/activity";
import type { StandardBioUserRecord } from "@/types/user-access";

type ActivitiesShellProps = {
  activities: Activity[];
  companies: Company[];
  pipelines: PipelineRow[];
  assignableUsers?: StandardBioUserRecord[];
};

type ActivitiesMode = "work" | "calendar";

const MODES: { id: ActivitiesMode; label: string; hint: string }[] = [
  { id: "work", label: "Work", hint: "Tasks, follow-ups, and what needs attention" },
  { id: "calendar", label: "Calendar", hint: "Meetings, visits, and events by day" },
];

function readMode(value: string | null): ActivitiesMode {
  return value === "calendar" ? "calendar" : "work";
}

export function ActivitiesShell({
  activities,
  companies,
  pipelines,
  assignableUsers = [],
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
      <header className="sticky top-0 z-10 flex h-11 shrink-0 items-center justify-between border-b border-carbon-blue/8 bg-[var(--dashboard-surface)]/95 px-4 backdrop-blur-sm">
        <div className="flex min-w-0 items-center gap-4">
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-carbon-blue">Activities</h1>
            <span className="hidden text-[11px] text-carbon-blue/40 sm:inline">{active.hint}</span>
          </div>
          <nav aria-label="Activities view" className="inline-flex border border-carbon-blue/12 bg-white">
            {MODES.map((item) => (
              <Link
                key={item.id}
                href={hrefFor(item.id)}
                aria-current={mode === item.id ? "page" : undefined}
                className={cn(
                  "px-3 py-1 text-xs transition-colors",
                  mode === item.id
                    ? "bg-carbon-blue text-white"
                    : "text-carbon-blue/60 hover:bg-carbon-blue/[0.04] hover:text-carbon-blue",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <ThemeToggle />
      </header>

      {mode === "calendar" ? (
        <ActivityCalendar />
      ) : (
        <WorkspaceMain>
          <SmartActivityWorkspace
            activities={activities}
            companies={companies}
            pipelines={pipelines}
            assignableUsers={assignableUsers}
            variant="page"
          />
        </WorkspaceMain>
      )}
    </WorkspaceChrome>
  );
}
