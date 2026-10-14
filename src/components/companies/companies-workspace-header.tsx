"use client";

import { WorkspacePageTitle } from "@/components/ui/workspace-page-title";
import { WorkspaceAddMenu, type WorkspaceAddMenuItem } from "@/components/ui/workspace-add-menu";
import { canCreateCompany } from "@/lib/permissions";
import type { UserRole } from "@/types/auth";

export type CompaniesWorkspaceTool =
  | null
  | "new-company"
  | "quick-import"
  | "website-discovery"
  | "bulk-import";

type CompaniesWorkspaceHeaderProps = {
  role: UserRole;
  activeTool: CompaniesWorkspaceTool;
  onToolChange: (tool: CompaniesWorkspaceTool) => void;
};

const ADD_ITEMS: WorkspaceAddMenuItem<NonNullable<CompaniesWorkspaceTool>>[] = [
  { id: "new-company", label: "New company", hint: "Type it in yourself", primary: true },
  { id: "quick-import", label: "Quick import", hint: "From a registry number or name" },
  { id: "website-discovery", label: "Website discovery", hint: "Read a company website" },
  { id: "bulk-import", label: "Bulk import", hint: "Paste or upload a list" },
];

export function CompaniesWorkspaceHeader({
  role,
  activeTool,
  onToolChange,
}: CompaniesWorkspaceHeaderProps) {
  const canManage = canCreateCompany(role);

  return (
    <WorkspacePageTitle
      icon="company"
      title="Companies"
      subtitle="Every relationship we hold — what kind it is, what matters now, and who owns it."
      actions={
        canManage ? (
          <WorkspaceAddMenu items={ADD_ITEMS} activeTool={activeTool} onSelect={onToolChange} />
        ) : null
      }
    />
  );
}
