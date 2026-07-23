"use client";

import { toEnterpriseRole } from "@/lib/security/rbac";
import type { UserRole } from "@/types/auth";

const BADGE_STYLES_NAV: Record<string, string> = {
  ADMIN: "border-upcycle-orange/50 bg-upcycle-orange/15 text-upcycle-orange",
  MANAGER: "border-white/25 bg-white/10 text-white",
  REP: "border-white/15 bg-white/5 text-light-grey/80",
};

const BADGE_STYLES_LIGHT: Record<string, string> = {
  ADMIN: "border-upcycle-orange/40 bg-upcycle-orange/10 text-upcycle-orange",
  MANAGER: "border-carbon-blue/25 bg-carbon-blue/5 text-carbon-blue",
  REP: "border-carbon-blue/15 bg-carbon-blue/[0.03] text-carbon-blue/70",
};

/** FS-013 enterprise role badge for navigation. */
export function EnterpriseRoleBadge({
  accessRole,
  compact = false,
  tone = "nav",
}: {
  accessRole: UserRole;
  compact?: boolean;
  /** `nav` = dark sidebar; `light` = header chrome */
  tone?: "nav" | "light";
}) {
  const role = toEnterpriseRole(accessRole);
  const styles = tone === "light" ? BADGE_STYLES_LIGHT : BADGE_STYLES_NAV;
  return (
    <span
      className={`inline-flex items-center border px-1.5 py-0.5 font-semibold uppercase tracking-wider ${
        compact ? "text-[8px]" : "text-[9px]"
      } ${styles[role] ?? styles.REP}`}
      title={`Enterprise role: ${role}`}
    >
      {role}
    </span>
  );
}
