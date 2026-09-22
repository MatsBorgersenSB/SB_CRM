"use client";

import { useState } from "react";
import { OutlookRelationshipCardPane } from "@/components/m365/outlook-relationship-card-pane";
import { OutlookTenderRadarPane } from "@/components/m365/outlook-tender-radar-pane";
import { attioSegmentItemClass, ATTIO_SEGMENT_TRACK } from "@/lib/attio-workspace-surfaces";

type OutlookTaskPaneTab = "relationship" | "tender-radar";

export function OutlookTaskPaneTabs() {
  const [tab, setTab] = useState<OutlookTaskPaneTab>("relationship");

  return (
    <div className="flex h-[100dvh] flex-col bg-white">
      <div className="shrink-0 border-b border-carbon-blue/10 px-3 py-2">
        <div className={ATTIO_SEGMENT_TRACK} role="tablist" aria-label="Outlook pane">
          <button
            type="button"
            className={attioSegmentItemClass(tab === "relationship")}
            onClick={() => setTab("relationship")}
          >
            👤 Relationship
          </button>
          <button
            type="button"
            className={attioSegmentItemClass(tab === "tender-radar")}
            onClick={() => setTab("tender-radar")}
          >
            🛰️ Tender Radar
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === "relationship" ? <OutlookRelationshipCardPane /> : <OutlookTenderRadarPane />}
      </div>
    </div>
  );
}
