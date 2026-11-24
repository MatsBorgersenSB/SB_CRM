"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { formatShortDate } from "@/lib/regional-format-preference";
import type { MyTasksOverview, MyWorkItem } from "@/lib/my-work-queue";

function dueLabel(dueDate: string | null | undefined, today: string): string | null {
  if (!dueDate) return null;
  const pretty = formatShortDate(dueDate, dueDate);
  if (dueDate < today) return `Overdue · ${pretty}`;
  if (dueDate === today) return `Due today · ${pretty}`;
  return `Due ${pretty}`;
}

function TaskRow({
  item,
  today,
}: {
  item: MyWorkItem;
  today: string;
}) {
  const due = dueLabel(item.dueDate, today);
  const overdue = Boolean(item.dueDate && item.dueDate < today);

  return (
    <li>
      <Link
        href={item.href}
        className="flex flex-col gap-0.5 px-4 py-3 transition-colors hover:bg-carbon-blue/[0.03]"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <span className="text-[15px] font-semibold text-carbon-blue">{item.title}</span>
          {due ? (
            <span
              className={`shrink-0 text-[12px] font-medium ${
                overdue ? "text-thermal-red" : "text-carbon-blue/50"
              }`}
            >
              {due}
            </span>
          ) : (
            <span className="shrink-0 text-[12px] text-carbon-blue/40">
              {item.kind === "shared_task" ? "Watching" : "Open"}
            </span>
          )}
        </div>
        <p className="text-[12px] text-carbon-blue/55">
          {item.why}
          {item.companyName ? ` · ${item.companyName}` : ""}
        </p>
        <p className="text-[12px] font-medium text-upcycle-orange">{item.next}</p>
      </Link>
    </li>
  );
}

function OwnRow({ item }: { item: MyWorkItem }) {
  return (
    <li>
      <Link
        href={item.href}
        className="flex items-baseline justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-carbon-blue/[0.03]"
      >
        <span className="min-w-0">
          <span className="text-[14px] font-semibold text-carbon-blue">{item.title}</span>
          <span className="mt-0.5 block text-[12px] text-carbon-blue/50">
            {item.kind === "company" ? "Company" : "Deal"}
            {item.companyName && item.kind === "opportunity" ? ` · ${item.companyName}` : ""}
          </span>
        </span>
        <span className="shrink-0 text-[12px] font-medium text-upcycle-orange">Open →</span>
      </Link>
    </li>
  );
}

type MyTasksOverviewPanelProps = {
  overview: MyTasksOverview;
  today?: string;
  /** Sits after Do now (before You own) — e.g. Ask a teammate. */
  afterDoNow?: ReactNode;
};

/**
 * Personal task 360 — hero stats + Do now + You own.
 * Michelin: tasks first; companies/deals secondary.
 */
export function MyTasksOverviewPanel({
  overview,
  today = new Date().toISOString().slice(0, 10),
  afterDoNow = null,
}: MyTasksOverviewPanelProps) {
  const { doNow, youOwn, openCount, overdueCount, nextDue } = overview;

  const heroBits = [
    `${openCount} open`,
    overdueCount > 0 ? `${overdueCount} overdue` : null,
    nextDue ? `next due ${formatShortDate(nextDue, nextDue)}` : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-8">
      <div className="border border-carbon-blue/10 bg-white px-5 py-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-carbon-blue/45">
          Your tasks
        </p>
        <p className="mt-2 text-[22px] font-semibold leading-snug text-carbon-blue">
          {openCount === 0
            ? "You're clear"
            : overdueCount > 0
              ? "Something needs you now"
              : "Here's what to do"}
        </p>
        <p className="mt-1.5 text-[14px] text-carbon-blue/60">
          {openCount === 0
            ? "No open tasks assigned to you. When a teammate gives you work, it lands here."
            : heroBits.join(" · ")}
        </p>
      </div>

      <section aria-labelledby="do-now-heading">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h2
            id="do-now-heading"
            className="text-[11px] font-semibold uppercase tracking-[0.14em] text-carbon-blue/45"
          >
            Do now
          </h2>
          {openCount > 0 ? (
            <Link
              href="/activities?filter=my_tasks"
              className="text-[12px] font-semibold text-carbon-blue/55 hover:text-upcycle-orange"
            >
              See all →
            </Link>
          ) : null}
        </div>
        {doNow.length === 0 ? (
          <p className="border border-carbon-blue/10 px-4 py-4 text-[14px] text-carbon-blue/60">
            Nothing waiting. Ask a teammate from mail, a company, a deal, or a project when you need
            help.
          </p>
        ) : (
          <ul className="divide-y divide-carbon-blue/8 border border-carbon-blue/10">
            {doNow.slice(0, 12).map((item) => (
              <TaskRow key={item.id} item={item} today={today} />
            ))}
          </ul>
        )}
      </section>

      {afterDoNow}

      {youOwn.length > 0 ? (
        <section aria-labelledby="you-own-heading">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h2
              id="you-own-heading"
              className="text-[11px] font-semibold uppercase tracking-[0.14em] text-carbon-blue/45"
            >
              You own
            </h2>
            <span className="text-[12px] text-carbon-blue/45">{youOwn.length}</span>
          </div>
          <ul className="divide-y divide-carbon-blue/8 border border-carbon-blue/10">
            {youOwn.slice(0, 8).map((item) => (
              <OwnRow key={item.id} item={item} />
            ))}
          </ul>
          {youOwn.length > 8 ? (
            <p className="mt-2 text-[12px] text-carbon-blue/50">
              {youOwn.length - 8} more ·{" "}
              <Link href="/companies" className="font-semibold text-upcycle-orange hover:underline">
                Companies
              </Link>
              {" · "}
              <Link
                href="/opportunities"
                className="font-semibold text-upcycle-orange hover:underline"
              >
                Deals
              </Link>
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
