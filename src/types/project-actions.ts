export const PROJECT_ACTION_TABS = [
  { id: "questions", label: "Questions" },
  { id: "activities", label: "Activities" },
  { id: "documents", label: "Documents" },
  { id: "organizations", label: "Organizations" },
  { id: "stakeholders", label: "Stakeholders" },
  { id: "milestones", label: "Milestones" },
  { id: "decisions", label: "Decisions" },
] as const;

export type ProjectActionTab = (typeof PROJECT_ACTION_TABS)[number]["id"];

export const DEFAULT_PROJECT_ACTION_TAB: ProjectActionTab = "activities";

export function isProjectActionTab(value: string | null): value is ProjectActionTab {
  return PROJECT_ACTION_TABS.some((tab) => tab.id === value);
}

export function legacyProjectTabToActionTab(tab: string | null): ProjectActionTab | null {
  if (!tab) return null;
  if (tab === "team") return "stakeholders";
  if (tab === "validations") return "questions";
  if (tab === "conversations") return "questions";
  if (isProjectActionTab(tab)) return tab;
  return null;
}
