"use client";

import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { M365MailSyncHeaderButton } from "@/components/m365/m365-mail-sync-header-button";

/**
 * Standard workspace chrome — left nav, global sync control, and main content.
 * SmartAssist intelligence is embedded in each workspace (no floating widget).
 */
export function WorkspaceChrome({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--dashboard-bg)]">
      <Sidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-carbon-blue/10 bg-[var(--dashboard-surface)] px-4">
          <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/40">
            Outlook
          </p>
          <M365MailSyncHeaderButton />
        </div>
        {children}
      </div>
    </div>
  );
}
