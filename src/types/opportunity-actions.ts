export const OPPORTUNITY_ACTION_TABS = [
  { id: "activities", label: "Activities" },
  { id: "documents", label: "Documents" },
  { id: "stakeholders", label: "Stakeholders" },
  { id: "questions", label: "Questions" },
  { id: "validations", label: "Validations" },
  { id: "conversations", label: "Conversations" },
  { id: "timeline", label: "Timeline" },
] as const;

export type OpportunityActionTab = (typeof OPPORTUNITY_ACTION_TABS)[number]["id"];

export const DEFAULT_OPPORTUNITY_ACTION_TAB: OpportunityActionTab = "activities";

export function isOpportunityActionTab(value: string | null): value is OpportunityActionTab {
  return OPPORTUNITY_ACTION_TABS.some((tab) => tab.id === value);
}

/** Legacy workspace tab ids mapped to action tabs or redirects */
export function legacyWorkspaceTabToActionTab(
  tab: string | null,
): OpportunityActionTab | null {
  if (!tab) return null;
  if (isOpportunityActionTab(tab)) return tab;

  const redirectOnly = new Set([
    "commercial",
    "knowledge",
    "viability",
    "cvm",
    "intelligence",
    "attention",
  ]);
  if (redirectOnly.has(tab)) return null;

  return null;
}
