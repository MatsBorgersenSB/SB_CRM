import type { ReactNode } from "react";

export function OpportunityExecutionSection({
  title,
  count,
  children,
  action,
  id,
}: {
  title: string;
  count?: number;
  children: ReactNode;
  action?: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="dashboard-card p-4 sm:p-5">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.12em] text-carbon-blue/40">
          {title}
          {count !== undefined ? (
            <span className="ml-1.5 font-semibold tabular-nums text-carbon-blue/55">
              ({count})
            </span>
          ) : null}
        </h2>
        {action}
      </header>
      {children}
    </section>
  );
}
