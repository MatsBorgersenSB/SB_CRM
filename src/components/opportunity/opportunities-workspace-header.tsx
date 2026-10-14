"use client";

import { WorkspacePageTitle } from "@/components/ui/workspace-page-title";
import { WorkspaceAddMenu, type WorkspaceAddMenuItem } from "@/components/ui/workspace-add-menu";
import { canCreateCompany, canCreateOpportunity } from "@/lib/permissions";
import type { UserRole } from "@/types/auth";

export type OpportunitiesWorkspaceTool =
  | null
  | "new-opportunity"
  | "quick-import"
  | "import-deals";

type OpportunitiesWorkspaceHeaderProps = {
  role: UserRole;
  activeTool: OpportunitiesWorkspaceTool;
  onToolChange: (tool: OpportunitiesWorkspaceTool) => void;
};

export function OpportunitiesWorkspaceHeader({
  role,
  activeTool,
  onToolChange,
}: OpportunitiesWorkspaceHeaderProps) {
  const items: WorkspaceAddMenuItem<NonNullable<OpportunitiesWorkspaceTool>>[] = [];
  if (canCreateOpportunity(role)) {
    items.push({
      id: "new-opportunity",
      label: "New opportunity",
      hint: "Type it in yourself",
      primary: true,
    });
  }
  if (canCreateCompany(role)) {
    items.push(
      { id: "quick-import", label: "Quick import", hint: "From a company name or registry number" },
      { id: "import-deals", label: "Import deals", hint: "Paste or upload a list of deals" },
    );
  }

  return (
    <WorkspacePageTitle
      icon="opportunity"
      title="Opportunities"
      subtitle="Every deal we are pursuing — what the customer wants, what is blocking it, and what happens next."
      actions={
        items.length > 0 ? (
          <WorkspaceAddMenu items={items} activeTool={activeTool} onSelect={onToolChange} />
        ) : null
      }
    />
  );
}
