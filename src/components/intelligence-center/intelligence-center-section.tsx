import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function IntelligenceCenterSection({
  title,
  description,
  count,
  href,
  children,
  emptyMessage,
  accent = "default",
}: {
  title: string;
  description: string;
  count: number;
  href?: string;
  children: ReactNode;
  emptyMessage: string;
  accent?: "default" | "risk" | "growth" | "strategic";
}) {
  const accentStyles = {
    default: "border-carbon-blue/8",
    risk: "border-red-500/20",
    growth: "border-emerald-500/20",
    strategic: "border-violet-500/20",
  } as const;

  return (
    <section
      className={`dashboard-card flex flex-col overflow-hidden border-t-2 ${accentStyles[accent]}`}
    >
      <header className="flex items-start justify-between gap-3 border-b border-carbon-blue/8 px-4 py-3.5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-carbon-blue">{title}</h2>
            <span className="border border-carbon-blue/10 bg-carbon-blue/[0.03] px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-carbon-blue/55">
              {count}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-carbon-blue/45">{description}</p>
        </div>
        {href ? (
          <Link
            href={href}
            className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold text-upcycle-orange"
          >
            View
            <ArrowRight className="size-3" />
          </Link>
        ) : null}
      </header>

      {count === 0 ? (
        <p className="px-4 py-8 text-center text-xs text-carbon-blue/45">{emptyMessage}</p>
      ) : (
        <div className="flex-1">{children}</div>
      )}
    </section>
  );
}
