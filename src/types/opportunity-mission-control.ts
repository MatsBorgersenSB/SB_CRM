import type { OpportunityActionTab } from "@/types/opportunity-actions";

/**
 * Four tabs. Actions renamed to Work; nested action sub-tabs removed from chrome.
 * Work is one living surface (activity + mail + meetings + documents).
 */
export const OPPORTUNITY_MISSION_CONTROL_VIEWS = [
  { id: "overview", label: "Overview" },
  { id: "understanding", label: "Understanding" },
  { id: "work", label: "Work" },
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
  /** Optional deep-link into a Work section (legacy action=). */
  action?: OpportunityActionTab;
};

/**
 * Old links keep working: gaps/influence → Understanding, meetings/emails/actions → Work.
 * Returns null when the location is already current.
 */
export function mapLegacyDealLocation(
  view: string | null,
  action: string | null,
): DealLocation | null {
  switch (view) {
    case "gaps":
    case "influence":
      return { view: "understanding" };
    case "actions":
      if (action === "stakeholders") return { view: "overview" };
      return {
        view: "work",
        action: action ? (action as OpportunityActionTab) : undefined,
      };
    case "meetings":
      return { view: "work", action: "meetings" };
    case "emails":
      return { view: "work", action: "emails" };
    default:
      break;
  }
  if (action === "stakeholders") return { view: "overview" };
  return null;
}
