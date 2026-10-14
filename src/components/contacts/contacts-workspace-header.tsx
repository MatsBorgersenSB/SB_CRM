"use client";

import { SmartCRMIcon } from "@/components/ui/smartcrm-icon";
import { WorkspaceAddMenu, type WorkspaceAddMenuItem } from "@/components/ui/workspace-add-menu";
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

const ADD_ITEMS: WorkspaceAddMenuItem<NonNullable<ContactsWorkspaceTool>>[] = [
  { id: "new-contact", label: "New contact", hint: "Type it in yourself", primary: true },
  { id: "quick-import", label: "Quick import", hint: "From a registry number or name" },
  { id: "website-discovery", label: "Website discovery", hint: "Read people off a company website" },
  { id: "bulk-import", label: "Bulk import", hint: "Paste or upload a list" },
];

export function ContactsWorkspaceHeader({
  role,
  activeTool,
  onToolChange,
}: ContactsWorkspaceHeaderProps) {
  const canManage = canCreateCompany(role);

  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-carbon-blue sm:text-2xl">
          <SmartCRMIcon name="contact" size="md" label="Contacts" />
          People
        </h1>
        <p className="mt-1 text-[11px] text-carbon-blue/50">
          The people behind the relationships — their role, their buying role, and when we last spoke.
        </p>
      </div>

      {canManage ? (
        <WorkspaceAddMenu items={ADD_ITEMS} activeTool={activeTool} onSelect={onToolChange} />
      ) : null}
    </div>
  );
}
