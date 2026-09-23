"use client";

import { useState } from "react";
import { OutlookRelationshipCardPane } from "@/components/m365/outlook-relationship-card-pane";
import { OutlookTenderRadarPane } from "@/components/m365/outlook-tender-radar-pane";
import { SegmentedControl } from "@/components/ui/segmented-control";

type OutlookTaskPaneTab = "relationship" | "tender-radar";

export function OutlookTaskPaneTabs() {
  const [tab, setTab] = useState<OutlookTaskPaneTab>("relationship");

  return (
    <div className="flex h-[100dvh] flex-col bg-background">
      <div className="shrink-0 border-b border-border/60 px-3 py-2">
        <SegmentedControl
          ariaLabel="Outlook pane"
          value={tab}
          onChange={setTab}
          options={[
            { value: "relationship", label: "Relationship" },
            { value: "tender-radar", label: "Tender Radar" },
          ]}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === "relationship" ? <OutlookRelationshipCardPane /> : <OutlookTenderRadarPane />}
      </div>
    </div>
  );
}
