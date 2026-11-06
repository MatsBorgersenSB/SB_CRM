"use client";

import type { ReactNode } from "react";
import { RoleSwitcher } from "@/components/auth/role-switcher";
import { SmartCRMIcon } from "@/components/ui/smartcrm-icon";
import type { SmartCRMIconName } from "@/lib/smartcrm-visual-language";

/**
 * The one sticky top bar every list workspace uses.
 *
 * Left: the same icon and word as the sidebar entry, so the user always
 * sees where they are. Middle: optional view switcher. Right: theme,
 * notifications and the signed-in user — identical on every page.
 */
export function WorkspaceTopBar({
  icon,
  title,
  children,
  actions,
}: {
  icon: SmartCRMIconName;
  title: string;
  /** Optional controls that belong to the page, e.g. a view toggle. */
  children?: ReactNode;
  /** Replace the default theme / bell / avatar cluster. */
  actions?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-10 flex h-11 shrink-0 items-center justify-between gap-4 border-b border-carbon-blue/8 bg-[var(--dashboard-surface)]/95 px-4 backdrop-blur-sm">
      <div className="flex min-w-0 items-center gap-4">
        <div
          className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/50"
          aria-label={`${title} workspace`}
        >
          <SmartCRMIcon name={icon} size="xs" className="text-carbon-blue/45" />
          <span className="truncate">{title}</span>
        </div>
        {children}
      </div>
      {actions ?? <RoleSwitcher />}
    </header>
  );
}
