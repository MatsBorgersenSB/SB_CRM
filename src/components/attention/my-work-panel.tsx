"use client";

import Link from "next/link";
import type { MyWorkItem, MyWorkQueue } from "@/lib/my-work-queue";
import { flattenMyWorkQueue } from "@/lib/my-work-queue";

const KIND_LABEL: Record<MyWorkItem["kind"], string> = {
  company: "Company",
  opportunity: "Deal",
  task: "Yours",
  shared_task: "Watching",
};

type MyWorkPanelProps = {
  queue: MyWorkQueue;
  /** Cap primary list (Michelin). */
  limit?: number;
};

export function MyWorkPanel({ queue, limit = 8 }: MyWorkPanelProps) {
  const items = flattenMyWorkQueue(queue);
  const visible = items.slice(0, limit);
  const hidden = items.length - visible.length;

  if (items.length === 0) {
    return (
      <p className="text-sm text-carbon-blue/65">
        Nothing for you yet. When a teammate gives you work or asks for help, it lands here.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] text-carbon-blue/55">
        Open one · do the next step · that is collaboration.
      </p>
      <ul className="divide-y divide-carbon-blue/8 border border-carbon-blue/10">
        {visible.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              className="flex flex-col gap-0.5 px-3 py-2.5 transition-colors hover:bg-carbon-blue/[0.03]"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[14px] font-semibold text-carbon-blue">
                  {item.title}
                </span>
                <span className="shrink-0 text-[11px] text-carbon-blue/45">
                  {KIND_LABEL[item.kind]}
                  {item.dueDate ? ` · ${item.dueDate}` : ""}
                </span>
              </div>
              <p className="text-[12px] text-carbon-blue/55">
                {item.why}
                {item.companyName ? ` · ${item.companyName}` : ""}
              </p>
              <p className="text-[12px] font-medium text-upcycle-orange">{item.next}</p>
            </Link>
          </li>
        ))}
      </ul>
      {hidden > 0 ? (
        <p className="px-1 text-xs text-muted-foreground">
          {hidden} more ·{" "}
          <Link href="/activities?filter=my_tasks" className="font-medium text-carbon-blue hover:text-upcycle-orange">
            See all your jobs
          </Link>
        </p>
      ) : null}
    </div>
  );
}
