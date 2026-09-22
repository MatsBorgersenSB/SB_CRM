"use client";

import { useSearchParams } from "next/navigation";
import { OutlookComposeAssignPane } from "@/components/m365/outlook-compose-assign-pane";
import { OutlookTaskPaneTabs } from "@/components/m365/outlook-task-pane-tabs";

/**
 * Routes Outlook add-in task pane by ?mode=compose vs read (default).
 * Read mode: Relationship | Tender Radar.
 */
export function OutlookAddinModeRouter() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode")?.trim().toLowerCase();

  if (mode === "compose") {
    return <OutlookComposeAssignPane />;
  }

  return <OutlookTaskPaneTabs />;
}
