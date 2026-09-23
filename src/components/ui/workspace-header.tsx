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
    <header className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-4 border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur-sm">
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium tracking-tight text-muted-foreground">
          {scope}
        </p>
        <p className="truncate font-semibold tracking-tight text-foreground">{title}</p>
        {context ? (
          <div className="hidden truncate text-sm leading-relaxed text-muted-foreground sm:block">
            {context}
          </div>
        ) : null}
      </div>
      <div className="shrink-0">{actions ?? <ThemeToggle />}</div>
    </header>
  );
}
