import type { Activity } from "@/types/activity";
import type { AuthUser } from "@/types/auth";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import { company360Href } from "@/types/company-360";
import {
  authUserAsColleague,
  personMatchesColleague,
  type ColleagueIdentity,
} from "@/lib/colleague-identity";
import { isCompanyOwnedByUser } from "@/lib/company-owner";
import { resolveOpportunityOwner } from "@/lib/opportunity-owner";
import { isTaskSharedWithUser } from "@/lib/task-sharing";

export type MyWorkKind = "company" | "opportunity" | "task" | "shared_task";

export type MyWorkItem = {
  id: string;
  kind: MyWorkKind;
  title: string;
  why: string;
  next: string;
  href: string;
  dueDate?: string | null;
  companyName?: string | null;
};

export type MyWorkQueue = {
  assigned: MyWorkItem[];
  watching: MyWorkItem[];
};

/** Stupid-simple personal task 360 — what I must do vs what I own. */
export type MyTasksOverview = {
  doNow: MyWorkItem[];
  youOwn: MyWorkItem[];
  openCount: number;
  overdueCount: number;
  nextDue: string | null;
};

function colleagueFromUser(user: AuthUser): ColleagueIdentity {
  return authUserAsColleague(user);
}

function openTask(activity: Activity): boolean {
  return (
    activity.ActivityType === "Task" &&
    activity.ActionStatus !== "Completed" &&
    activity.ActionStatus !== "Cancelled"
  );
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function isTaskKind(kind: MyWorkKind): boolean {
  return kind === "task" || kind === "shared_task";
}

/**
 * Slice My Work into a personal tasks cockpit.
 * Do now = tasks assigned to me or shared for me to act on.
 * You own = companies / deals (secondary — not the hero).
 */
export function buildMyTasksOverview(
  queue: MyWorkQueue,
  today: string = todayIsoDate(),
): MyTasksOverview {
  const doNow = [...queue.assigned, ...queue.watching]
    .filter((item) => isTaskKind(item.kind))
    .sort((a, b) => {
      const dueA = a.dueDate ?? "9999";
      const dueB = b.dueDate ?? "9999";
      if (dueA !== dueB) return dueA.localeCompare(dueB);
      return a.title.localeCompare(b.title);
    });

  const youOwn = queue.assigned.filter(
    (item) => item.kind === "company" || item.kind === "opportunity",
  );

  const overdueCount = doNow.filter(
    (item) => item.dueDate && item.dueDate < today,
  ).length;
  const nextDue =
    doNow.map((item) => item.dueDate).find((due) => Boolean(due)) ?? null;

  return {
    doNow,
    youOwn,
    openCount: doNow.length,
    overdueCount,
    nextDue,
  };
}

/**
 * Personal operating queue: what I own + what I was shared to watch.
 * Answers: what did I inherit / what am I watching?
 */
export function buildMyWorkQueue(input: {
  user: AuthUser;
  companies: Company[];
  pipelines: PipelineRow[];
  activities: Activity[];
}): MyWorkQueue {
  const colleague = colleagueFromUser(input.user);
  const assigned: MyWorkItem[] = [];
  const watching: MyWorkItem[] = [];

  for (const company of input.companies) {
    if (!isCompanyOwnedByUser(company, input.user)) continue;
    assigned.push({
      id: `company:${company.CompanyID}`,
      kind: "company",
      title: company.Title,
      why: "This company is yours",
      next: "Open it · decide what to do",
      href: company360Href(company.CompanyID),
      companyName: company.Title,
    });
  }

  const companyById = new Map(input.companies.map((c) => [c.CompanyID, c]));

  for (const pipeline of input.pipelines) {
    const companyId =
      pipeline.linkedCompanyIds?.[0] ||
      pipeline.ClientLookup ||
      undefined;
    const company = companyId ? companyById.get(companyId) : undefined;
    const owner = resolveOpportunityOwner(pipeline, company);
    if (!personMatchesColleague(owner, colleague)) continue;
    assigned.push({
      id: `opportunity:${pipeline.id}`,
      kind: "opportunity",
      title: pipeline.assetName || pipeline.id,
      why: "This deal is yours",
      next: "Open it · clear the blocker",
      href: `/opportunities/${encodeURIComponent(pipeline.id)}`,
      companyName: company?.Title ?? pipeline.ClientLookup ?? null,
    });
  }

  for (const activity of input.activities) {
    if (!openTask(activity)) continue;
    const owned = personMatchesColleague(activity.ActivityOwner, colleague);
    const shared = isTaskSharedWithUser(activity, colleague);
    if (!owned && !shared) continue;

    const item: MyWorkItem = {
      id: `task:${activity.ActivityID}`,
      kind: owned ? "task" : "shared_task",
      title: activity.Subject || "Task",
      why: owned ? "Assigned to you" : "Shared with you — watch or help",
      next: activity.NextAction?.trim() || "Open it · take the next step",
      href: `/activities/${encodeURIComponent(activity.ActivityID)}`,
      dueDate: activity.NextActionDate ?? activity.ActivityDate?.slice(0, 10) ?? null,
      companyName: activity.Company?.Title ?? activity.ProjectName ?? null,
    };

    if (owned) assigned.push(item);
    else watching.push(item);
  }

  const sortItems = (items: MyWorkItem[]) =>
    [...items].sort((a, b) => {
      const dueA = a.dueDate ?? "9999";
      const dueB = b.dueDate ?? "9999";
      if (dueA !== dueB) return dueA.localeCompare(dueB);
      return a.title.localeCompare(b.title);
    });

  return {
    assigned: sortItems(assigned),
    watching: sortItems(watching),
  };
}

export function flattenMyWorkQueue(queue: MyWorkQueue): MyWorkItem[] {
  return [...queue.assigned, ...queue.watching];
}
