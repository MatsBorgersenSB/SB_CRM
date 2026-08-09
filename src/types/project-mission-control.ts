export const PROJECT_MISSION_CONTROL_VIEWS = [
  { id: "overview", label: "Overview" },
  { id: "gaps", label: "Gaps" },
  { id: "understanding", label: "Understanding" },
  { id: "risks", label: "Risks" },
  { id: "emails", label: "Emails" },
  { id: "actions", label: "Actions" },
] as const;

export type ProjectMissionControlView =
  (typeof PROJECT_MISSION_CONTROL_VIEWS)[number]["id"];

export function isProjectMissionControlView(
  value: string | null,
): value is ProjectMissionControlView {
  return PROJECT_MISSION_CONTROL_VIEWS.some((view) => view.id === value);
}

export const DEFAULT_PROJECT_MISSION_CONTROL_VIEW: ProjectMissionControlView = "overview";
