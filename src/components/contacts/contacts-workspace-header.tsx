"use client";

import { useRouter } from "next/navigation";
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

type AddMenuId = NonNullable<ContactsWorkspaceTool> | "scan-card";

const ADD_ITEMS: WorkspaceAddMenuItem<AddMenuId>[] = [
  { id: "new-contact", label: "New contact", hint: "Type it in yourself", primary: true },
  { id: "scan-card", label: "Scan business card", hint: "Photo or PDF — we read it for you" },
  { id: "quick-import", label: "Quick import", hint: "From a registry number or name" },
  { id: "website-discovery", label: "Website discovery", hint: "Read people off a company website" },
  { id: "bulk-import", label: "Bulk import", hint: "Paste or upload a list" },
];

export function ContactsWorkspaceHeader({
  role,
  activeTool,
  onToolChange,
}: ContactsWorkspaceHeaderProps) {
  const router = useRouter();
  const canManage = canCreateCompany(role);

  const handleSelect = (id: AddMenuId | null) => {
    if (id === "scan-card") {
      router.push("/crm/intake");
      return;
    }
    onToolChange(id);
  };

  return (
    <WorkspacePageTitle
      icon="people"
      title="People"
      subtitle="The people behind the relationships — their role, their buying role, and when we last spoke."
      actions={
        canManage ? (
          <WorkspaceAddMenu items={ADD_ITEMS} activeTool={activeTool} onSelect={handleSelect} />
        ) : null
      }
    />
  );
}
