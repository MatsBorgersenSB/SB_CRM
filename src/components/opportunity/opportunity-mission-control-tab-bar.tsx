"use client";

import {
  ATTIO_SEGMENT_TRACK,
  attioSegmentItemClass,
} from "@/lib/attio-workspace-surfaces";
import {
  OPPORTUNITY_MISSION_CONTROL_VIEWS,
  type OpportunityMissionControlView,
} from "@/types/opportunity-mission-control";

/**
 * Attio-style segment control — fixed-size pills, no layout shift on select.
 */
export function OpportunityMissionControlTabBar({
  active,
  onChange,
}: {
  active: OpportunityMissionControlView;
  onChange: (view: OpportunityMissionControlView) => void;
}) {
  return (
    <nav
      aria-label="Mission control"
      className={ATTIO_SEGMENT_TRACK}
      role="tablist"
    >
      {OPPORTUNITY_MISSION_CONTROL_VIEWS.map((view) => {
        const selected = view.id === active;
        return (
          <button
            key={view.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(view.id)}
            className={attioSegmentItemClass(selected)}
          >
            {view.label}
          </button>
        );
      })}
    </nav>
  );
}
