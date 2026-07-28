"use client";

import { SmartCRMIcon } from "@/components/ui/smartcrm-icon";
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
  subtitle?: string;
};

/**
 * Hero title + action bar — aligned with Companies & Contacts workspace headers.
 */
export function OpportunitiesWorkspaceHeader({
  role,
  activeTool,
  onToolChange,
  subtitle = "Opportunity understanding & decision matrix — actions first, not statistics.",
}: OpportunitiesWorkspaceHeaderProps) {
  const canCreate = canCreateOpportunity(role);
  const canImport = canCreateCompany(role);

  const toggle = (tool: OpportunitiesWorkspaceTool) => {
    onToolChange(activeTool === tool ? null : tool);
  };

  if (!canCreate && !canImport) {
    return (
      <div className="space-y-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-carbon-blue sm:text-2xl">
            <SmartCRMIcon name="opportunity" size="md" label="Opportunities" />
            Opportunities
          </h1>
          <p className="mt-1 text-[11px] text-carbon-blue/50">{subtitle}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-carbon-blue sm:text-2xl">
          <SmartCRMIcon name="opportunity" size="md" label="Opportunities" />
          Opportunities
        </h1>
        <p className="mt-1 text-[11px] text-carbon-blue/50">{subtitle}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {canCreate ? (
          <WorkspaceAction
            label="+ New Opportunity"
            active={activeTool === "new-opportunity"}
            onClick={() => toggle("new-opportunity")}
            primary
          />
        ) : null}
        {canImport ? (
          <>
            <WorkspaceAction
              label="+ Quick Import"
              active={activeTool === "quick-import"}
              onClick={() => toggle("quick-import")}
            />
            <WorkspaceAction
              label="Import Deals"
              active={activeTool === "import-deals"}
              onClick={() => toggle("import-deals")}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}

function WorkspaceAction({
  label,
  active,
  onClick,
  primary = false,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
        primary
          ? active
            ? "border-upcycle-orange bg-upcycle-orange text-white"
            : "border-upcycle-orange bg-upcycle-orange text-white hover:bg-upcycle-orange/90"
          : active
            ? "border-upcycle-orange/40 bg-upcycle-orange/10 text-upcycle-orange"
            : "border-carbon-blue/12 text-carbon-blue/65 hover:border-upcycle-orange/30 hover:text-upcycle-orange"
      }`}
    >
      {label}
    </button>
  );
}
