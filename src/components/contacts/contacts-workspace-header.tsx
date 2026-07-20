"use client";

import { SmartCRMIcon } from "@/components/ui/smartcrm-icon";
import { canCreateCompany } from "@/lib/permissions";
import type { UserRole } from "@/types/auth";

export type ContactsWorkspaceTool =
  | null
  | "new-contact"
  | "quick-import"
  | "website-discovery"
  | "bulk-import";

type ContactsWorkspaceHeaderProps = {
  role: UserRole;
  activeTool: ContactsWorkspaceTool;
  onToolChange: (tool: ContactsWorkspaceTool) => void;
};

export function ContactsWorkspaceHeader({
  role,
  activeTool,
  onToolChange,
}: ContactsWorkspaceHeaderProps) {
  const canManage = canCreateCompany(role);

  const toggle = (tool: ContactsWorkspaceTool) => {
    onToolChange(activeTool === tool ? null : tool);
  };

  return (
    <div className="space-y-3">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-carbon-blue sm:text-2xl">
          <SmartCRMIcon name="contact" size="md" label="Contacts" />
          Contacts
        </h1>
        <p className="mt-1 text-[11px] text-carbon-blue/50">
          Create, import, discover, search, and open relationships — actions first, not statistics.
        </p>
      </div>

      {canManage ? (
        <div className="flex flex-wrap items-center gap-2">
          <WorkspaceAction
            label="+ New Contact"
            active={activeTool === "new-contact"}
            onClick={() => toggle("new-contact")}
            primary
          />
          <WorkspaceAction
            label="+ Quick Import"
            active={activeTool === "quick-import"}
            onClick={() => toggle("quick-import")}
          />
          <WorkspaceAction
            label="Website Discovery"
            active={activeTool === "website-discovery"}
            onClick={() => toggle("website-discovery")}
          />
          <WorkspaceAction
            label="Bulk Import"
            active={activeTool === "bulk-import"}
            onClick={() => toggle("bulk-import")}
          />
        </div>
      ) : null}
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
