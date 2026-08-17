import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme/theme-toggle";

/**
 * Adaptive workspace chrome — orients the user in one glance:
 * where they are, what workspace they are in, optional human context.
 */
export function WorkspaceHeader({
  scope,
  title,
  context,
  actions,
}: {
  scope: string;
  title: string;
  context?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-10 flex h-11 shrink-0 items-center justify-between border-b border-carbon-blue/8 bg-[var(--dashboard-surface)]/95 px-4 backdrop-blur-sm">
      <div className="min-w-0">
        <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/40">
          {scope}
        </p>
        <p className="truncate text-sm font-semibold text-carbon-blue">{title}</p>
        {context ? (
          <div className="hidden truncate text-[10px] text-carbon-blue/45 sm:block">{context}</div>
        ) : null}
      </div>
      <div className="shrink-0">{actions ?? <ThemeToggle />}</div>
    </header>
  );
}
