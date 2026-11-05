import type { OpportunityActionTab } from "@/types/opportunity-actions";

/**
 * FS-005A — four tabs. Gaps merged into Understanding; Influence lives under
 * Understanding; Meetings and Emails live under Actions.
 */
export const OPPORTUNITY_MISSION_CONTROL_VIEWS = [
  { id: "overview", label: "Overview" },
  { id: "understanding", label: "Understanding" },
  { id: "actions", label: "Actions" },
  { id: "ask", label: "Ask" },
] as const;

export type OpportunityMissionControlView =
  (typeof OPPORTUNITY_MISSION_CONTROL_VIEWS)[number]["id"];

/** Product sales (dryer, biochar) skip the investigation surface. */
export const PRODUCT_SALE_HIDDEN_VIEWS: readonly OpportunityMissionControlView[] = [
  "understanding",
];

export function isOpportunityMissionControlView(
  value: string | null,
): value is OpportunityMissionControlView {
  return OPPORTUNITY_MISSION_CONTROL_VIEWS.some((view) => view.id === value);
}

export const DEFAULT_MISSION_CONTROL_VIEW: OpportunityMissionControlView = "overview";

export type DealLocation = {
  view: OpportunityMissionControlView;
  action?: OpportunityActionTab;
};

/**
 * Old links keep working: gaps/influence → Understanding, meetings/emails → Actions,
 * stakeholders → Overview. Returns null when the location is already current.
 */
export function mapLegacyDealLocation(
  view: string | null,
  action: string | null,
): DealLocation | null {
  switch (view) {
    case "gaps":
    case "influence":
      return { view: "understanding" };
    case "meetings":
      return { view: "actions", action: "meetings" };
    case "emails":
      return { view: "actions", action: "emails" };
    default:
      break;
  }
  if (action === "stakeholders") return { view: "overview" };
  return null;
}
