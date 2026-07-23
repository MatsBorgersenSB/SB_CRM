export const OPPORTUNITY_MISSION_CONTROL_VIEWS = [
  { id: "overview", label: "Overview" },
  { id: "gaps", label: "Gaps" },
  { id: "understanding", label: "Understanding" },
  { id: "influence", label: "Influence Map" },
  { id: "meetings", label: "Meetings" },
  { id: "actions", label: "Actions" },
  { id: "ask", label: "Ask" },
] as const;

export type OpportunityMissionControlView =
  (typeof OPPORTUNITY_MISSION_CONTROL_VIEWS)[number]["id"];

export function isOpportunityMissionControlView(
  value: string | null,
): value is OpportunityMissionControlView {
  return OPPORTUNITY_MISSION_CONTROL_VIEWS.some((view) => view.id === value);
}

export const DEFAULT_MISSION_CONTROL_VIEW: OpportunityMissionControlView = "overview";
