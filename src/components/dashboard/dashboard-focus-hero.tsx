import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { FocusItem, FocusPriority } from "@/lib/relationship-intelligence";

const PRIORITY_STYLES: Record<
  FocusPriority,
  { dot: string; border: string; bg: string }
> = {
  critical: {
    dot: "bg-red-500",
    border: "border-red-500/20",
    bg: "bg-red-500/[0.03]",
  },
  high: {
    dot: "bg-upcycle-orange",
    border: "border-upcycle-orange/25",
    bg: "bg-upcycle-orange/[0.04]",
  },
  normal: {
    dot: "bg-emerald-500",
    border: "border-emerald-500/20",
    bg: "bg-emerald-500/[0.03]",
  },
};

function focusEmoji(priority: FocusPriority): string {
  if (priority === "critical") return "🔴";
  if (priority === "high") return "🟠";
  return "🟢";
}

export function DashboardFocusHero({ items }: { items: FocusItem[] }) {
  return (
    <section className="dashboard-card overflow-hidden">
      <header className="flex items-center justify-between border-b border-carbon-blue/8 px-5 py-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-upcycle-orange">
            Command Center
          </p>
          <h2 className="mt-0.5 text-lg font-semibold tracking-tight text-carbon-blue">
            Today&apos;s Focus
          </h2>
          <p className="mt-1 text-xs text-carbon-blue/45">
            What needs your attention right now
          </p>
        </div>
        <Link
          href="/activities"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-upcycle-orange transition-colors hover:text-upcycle-orange/80"
        >
          View all
          <ArrowRight className="size-3.5" />
        </Link>
      </header>

      {items.length === 0 ? (
        <div className="flex min-h-[200px] flex-col items-center justify-center px-6 py-10 text-center">
          <p className="text-base font-medium text-carbon-blue/70">All clear</p>
          <p className="mt-1 max-w-sm text-sm text-carbon-blue/45">
            No overdue actions or urgent opportunities. Your relationships are on track.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-carbon-blue/6">
          {items.map((item) => {
            const style = PRIORITY_STYLES[item.priority];
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className={`group flex items-start gap-4 px-5 py-4 transition-colors hover:${style.bg} hover:bg-carbon-blue/[0.02]`}
                >
                  <span className="mt-1 text-base leading-none" aria-hidden>
                    {focusEmoji(item.priority)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-carbon-blue group-hover:text-upcycle-orange">
                      {item.title}
                    </p>
                    <p className="mt-0.5 text-xs text-carbon-blue/55">{item.subtitle}</p>
                    {item.companyName ? (
                      <p className="mt-1 text-[11px] font-medium text-carbon-blue/40">
                        {item.companyName}
                      </p>
                    ) : null}
                    {"valueLabel" in item && item.valueLabel ? (
                      <p className="mt-1 text-xs font-semibold text-upcycle-orange">
                        {item.valueLabel}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={`mt-2 size-2 shrink-0 rounded-full ${style.dot}`}
                    aria-hidden
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
