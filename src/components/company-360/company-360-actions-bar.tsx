"use client";

import { SmartCRMIcon } from "@/components/ui/smartcrm-icon";
import { canCreateCompany } from "@/lib/permissions";
import type { UserRole } from "@/types/auth";

export type Company360ActiveTool =
  | null
  | "quick-import"
  | "website-discovery"
  | "edit-company";

type Company360ActionsBarProps = {
  role: UserRole;
  activeTool: Company360ActiveTool;
  onToolChange: (tool: Company360ActiveTool) => void;
  onNewContact: () => void;
};

export function Company360ActionsBar({
  role,
  activeTool,
  onToolChange,
  onNewContact,
}: Company360ActionsBarProps) {
  const canManage = canCreateCompany(role);

  if (!canManage) return null;

  const toggle = (tool: Company360ActiveTool) => {
    onToolChange(activeTool === tool ? null : tool);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-carbon-blue/8 pt-3">
      <p className="w-full text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/35">
        Account Actions
      </p>

      <ActionButton
        label="Quick Import"
        icon="document"
        active={activeTool === "quick-import"}
        onClick={() => toggle("quick-import")}
      />
      <ActionButton
        label="Website Discovery"
        icon="website"
        active={activeTool === "website-discovery"}
        onClick={() => toggle("website-discovery")}
      />
      <ActionButton
        label="New Contact"
        icon="add"
        active={false}
        onClick={onNewContact}
      />
      <ActionButton
        label={activeTool === "edit-company" ? "Editing…" : "Edit Company"}
        icon="edit"
        active={activeTool === "edit-company"}
        onClick={() => toggle("edit-company")}
      />
    </div>
  );
}

function ActionButton({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: "document" | "website" | "add" | "edit";
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
        active
          ? "border-upcycle-orange/40 bg-upcycle-orange/10 text-upcycle-orange"
          : "border-carbon-blue/12 text-carbon-blue/65 hover:border-upcycle-orange/30 hover:text-upcycle-orange"
      }`}
    >
      <SmartCRMIcon name={icon} size="xs" />
      {label}
    </button>
  );
}
