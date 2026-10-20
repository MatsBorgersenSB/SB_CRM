"use client";

import Link from "next/link";
import { Camera } from "lucide-react";
import { WorkspacePageTitle } from "@/components/ui/workspace-page-title";
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
    <WorkspacePageTitle
      icon="people"
      title="People"
      subtitle="The people behind the relationships — their role, their buying role, and when we last spoke."
      actions={
        canManage ? (
          <div className="flex items-center gap-2">
            <Link
              href="/crm/intake"
              className="inline-flex items-center gap-1.5 border border-upcycle-orange/40 bg-white px-3 py-1.5 text-[12px] font-semibold text-upcycle-orange transition-colors hover:bg-upcycle-orange/10"
            >
              <Camera className="size-3.5" strokeWidth={2} aria-hidden />
              Scan card
            </Link>
            <WorkspaceAddMenu items={ADD_ITEMS} activeTool={activeTool} onSelect={onToolChange} />
          </div>
        ) : null
      }
    />
  );
}
