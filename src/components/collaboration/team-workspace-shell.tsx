"use client";

import Link from "next/link";
import { useMemo } from "react";
import { MyTasksOverviewPanel } from "@/components/attention/my-tasks-overview";
import { WorkspaceChrome } from "@/components/layout/workspace-chrome";
import { WorkspaceHeader } from "@/components/ui/workspace-header";
import { WorkspaceMain, WorkspaceStack } from "@/components/ui/workspace-main";
import { IntelligenceLead } from "@/components/ui/intelligence-lead";
import { useAuth } from "@/context/auth-context";
import { buildMyTasksOverview, buildMyWorkQueue } from "@/lib/my-work-queue";
import { formatShortDate } from "@/lib/regional-format-preference";
import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";

type TeamWorkspaceShellProps = {
  companies: Company[];
  pipelines: PipelineRow[];
  activities: Activity[];
};

/**
 * Team home = personal work 360.
 * What am I looking at? My tasks.
 * What matters? Overdue / due next.
 * What next? Open one — or ask a teammate.
 */
export function TeamWorkspaceShell({
  companies,
  pipelines,
  activities,
}: TeamWorkspaceShellProps) {
  const { user } = useAuth();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const overview = useMemo(() => {
    const queue = buildMyWorkQueue({ user, companies, pipelines, activities });
    return buildMyTasksOverview(queue, today);
  }, [user, companies, pipelines, activities, today]);

  const leadTitle =
    overview.openCount === 0
      ? "No open tasks for you"
      : overview.overdueCount > 0
        ? `${overview.overdueCount} overdue · ${overview.openCount} open`
        : `${overview.openCount} open task${overview.openCount === 1 ? "" : "s"}`;

  const leadSummary =
    overview.openCount === 0
      ? "When someone assigns you work or asks for help, it shows up here."
      : overview.nextDue
        ? `Next due ${formatShortDate(overview.nextDue, overview.nextDue)} · open one below`
        : "Open one below · do the next step";

  return (
    <WorkspaceChrome>
      <WorkspaceHeader
        scope="Team"
        title="Your work"
        context="Tasks assigned to you · then what you own · ask when you need help"
      />
      <WorkspaceMain>
        <WorkspaceStack>
          <IntelligenceLead eyebrow="Team" title={leadTitle} summary={leadSummary} />

          <MyTasksOverviewPanel
            overview={overview}
            today={today}
            afterDoNow={
              <div className="border border-carbon-blue/10 bg-carbon-blue/[0.02] px-5 py-4">
                <p className="text-[14px] font-semibold text-carbon-blue">Need a teammate?</p>
                <p className="mt-1 text-[13px] text-carbon-blue/60">
                  Open mail, a company, a deal, or a project →{" "}
                  <span className="font-semibold text-upcycle-orange">Ask a teammate</span>.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href="/mail"
                    className="inline-flex items-center border border-upcycle-orange bg-upcycle-orange px-3 py-1.5 text-[12px] font-semibold text-white hover:opacity-90"
                  >
                    Open mail
                  </Link>
                  <Link
                    href="/companies"
                    className="inline-flex items-center border border-carbon-blue/20 bg-white px-3 py-1.5 text-[12px] font-semibold text-carbon-blue hover:border-upcycle-orange hover:text-upcycle-orange"
                  >
                    Companies
                  </Link>
                  <Link
                    href="/opportunities"
                    className="inline-flex items-center border border-carbon-blue/20 bg-white px-3 py-1.5 text-[12px] font-semibold text-carbon-blue hover:border-upcycle-orange hover:text-upcycle-orange"
                  >
                    Deals
                  </Link>
                  <Link
                    href="/projects"
                    className="inline-flex items-center border border-carbon-blue/20 bg-white px-3 py-1.5 text-[12px] font-semibold text-carbon-blue hover:border-upcycle-orange hover:text-upcycle-orange"
                  >
                    Projects
                  </Link>
                </div>
              </div>
            }
          />
        </WorkspaceStack>
      </WorkspaceMain>
    </WorkspaceChrome>
  );
}
