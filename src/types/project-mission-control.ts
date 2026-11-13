/**
 * Project Mission Control — aligned with Opportunity: Overview · Understanding · Work · Ask.
 * Gaps / Risks / Emails / Actions map via legacy helpers.
 */
export const PROJECT_MISSION_CONTROL_VIEWS = [
  { id: "overview", label: "Overview" },
  { id: "understanding", label: "Understanding" },
  { id: "work", label: "Work" },
  { id: "ask", label: "Ask" },
] as const;

export type ProjectMissionControlView =
  (typeof PROJECT_MISSION_CONTROL_VIEWS)[number]["id"];

export function isProjectMissionControlView(
  value: string | null,
): value is ProjectMissionControlView {
  return PROJECT_MISSION_CONTROL_VIEWS.some((view) => view.id === value);
}

export const DEFAULT_PROJECT_MISSION_CONTROL_VIEW: ProjectMissionControlView = "overview";

/** Map old project views onto the four-tab model. */
export function mapLegacyProjectView(
  view: string | null,
): ProjectMissionControlView | null {
  switch (view) {
    case "gaps":
    case "risks":
      return "understanding";
    case "emails":
    case "actions":
      return "work";
    default:
      return null;
  }
}
