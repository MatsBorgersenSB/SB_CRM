"use client";

import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";

/**
 * Standard workspace chrome — quiet rail and the page.
 * Mail sync lives in the sidebar footer, not a second product header.
 */
export function WorkspaceChrome({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
