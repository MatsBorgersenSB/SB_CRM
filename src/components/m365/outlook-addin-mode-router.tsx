"use client";

import { useSearchParams } from "next/navigation";
import { OutlookComposeAssignPane } from "@/components/m365/outlook-compose-assign-pane";
import { OutlookRelationshipCardPane } from "@/components/m365/outlook-relationship-card-pane";

/**
 * Routes Outlook add-in task pane by ?mode=compose vs read (default).
 */
export function OutlookAddinModeRouter() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode")?.trim().toLowerCase();

  if (mode === "compose") {
    return <OutlookComposeAssignPane />;
  }

  return <OutlookRelationshipCardPane />;
}
