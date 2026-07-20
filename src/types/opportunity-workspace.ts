export const OPPORTUNITY_WORKSPACE_TABS = [
  {
    id: "activities",
    label: "Activities",
    description: "Log interactions, follow-ups, and execution history.",
  },
  {
    id: "stakeholders",
    label: "Stakeholders",
    description: "Deal team, influence map, and contact coverage.",
  },
  {
    id: "documents",
    label: "Documents",
    description: "Contracts, proposals, and linked files.",
  },
  {
    id: "commercial",
    label: "Commercial",
    description: "Commercial viability, revenue path, and baseline analysis (expert detail).",
  },
  {
    id: "knowledge",
    label: "Knowledge",
    description: "Captured intelligence, document risks, and attention items.",
  },
] as const;

export type OpportunityWorkspaceTab = (typeof OPPORTUNITY_WORKSPACE_TABS)[number]["id"];

export function isOpportunityWorkspaceTab(value: string | null): value is OpportunityWorkspaceTab {
  return OPPORTUNITY_WORKSPACE_TABS.some((tab) => tab.id === value);
}
