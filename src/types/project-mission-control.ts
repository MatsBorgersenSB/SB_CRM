export const PROJECT_MISSION_CONTROL_VIEWS = [
  { id: "command", label: "Command Center" },
  { id: "stage-gates", label: "Stage-Gates & QA" },
  { id: "organizations", label: "Organizations & Stakeholders" },
  { id: "docs", label: "Docs & Decisions" },
] as const;

export type ProjectMissionControlView =
  (typeof PROJECT_MISSION_CONTROL_VIEWS)[number]["id"];

export function isProjectMissionControlView(
  value: string | null,
): value is ProjectMissionControlView {
  return PROJECT_MISSION_CONTROL_VIEWS.some((view) => view.id === value);
}

export const DEFAULT_PROJECT_MISSION_CONTROL_VIEW: ProjectMissionControlView =
  "command";

/** Map legacy Mission Control / Actions URL params onto the 4-tab architecture. */
export function resolveProjectMissionControlView(
  viewParam: string | null,
  actionParam: string | null,
  legacyTabParam: string | null,
): ProjectMissionControlView {
  if (isProjectMissionControlView(viewParam)) return viewParam;

  // Legacy top-level views
  if (
    viewParam === "overview" ||
    viewParam === "gaps" ||
    viewParam === "understanding" ||
    viewParam === "risks"
  ) {
    return "command";
  }

  const action = actionParam ?? legacyTabParam;
  if (
    action === "organizations" ||
    action === "stakeholders" ||
    action === "team"
  ) {
    return "organizations";
  }
  if (action === "milestones") return "stage-gates";
  if (
    action === "documents" ||
    action === "decisions" ||
    action === "activities"
  ) {
    return "docs";
  }
  if (
    action === "questions" ||
    action === "validations" ||
    action === "conversations"
  ) {
    return "command";
  }
  if (viewParam === "actions") {
    return "command";
  }

  return DEFAULT_PROJECT_MISSION_CONTROL_VIEW;
}
