"use client";

import { SmartCRMIcon } from "@/components/ui/smartcrm-icon";
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
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-carbon-blue sm:text-2xl">
          <SmartCRMIcon name="company" size="md" label="Companies" />
          Companies
        </h1>
        <p className="mt-1 text-[11px] text-carbon-blue/50">
          Every relationship we hold — what kind it is, what matters now, and who owns it.
        </p>
      </div>

      {canManage ? (
        <WorkspaceAddMenu items={ADD_ITEMS} activeTool={activeTool} onSelect={onToolChange} />
      ) : null}
    </div>
  );
}
