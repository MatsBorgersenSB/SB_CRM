"use client";

import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";

/**
 * Standard workspace chrome — left nav and main content.
 * SmartAssist intelligence is embedded in each workspace (no floating widget).
 */
export function WorkspaceChrome({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--dashboard-bg)]">
      <Sidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
