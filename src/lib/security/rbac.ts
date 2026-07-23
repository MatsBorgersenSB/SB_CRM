import type { AuthUser, UserRole } from "@/types/auth";

/** FS-013 enterprise Role (mirrors Prisma `Role` enum). */
export type EnterpriseRole = "ADMIN" | "MANAGER" | "REP";

/**
 * Map SmartCRM access tiers (SharePoint-aligned) → FS-013 enterprise Role.
 */
export function toEnterpriseRole(role: UserRole): EnterpriseRole {
  switch (role) {
    case "superuser":
    case "admin":
      return "ADMIN";
    case "commercial":
      return "MANAGER";
    case "engineer":
    case "client_lead":
    default:
      return "REP";
  }
}

export function hasRole(
  user: Pick<AuthUser, "role"> | { enterpriseRole: EnterpriseRole },
  allowedRoles: EnterpriseRole[],
): boolean {
  const enterpriseRole =
    "enterpriseRole" in user
      ? user.enterpriseRole
      : toEnterpriseRole(user.role);
  return allowedRoles.includes(enterpriseRole);
}

export function isAdmin(user: Pick<AuthUser, "role">): boolean {
  return hasRole(user, ["ADMIN"]);
}

export function isManagerOrAbove(user: Pick<AuthUser, "role">): boolean {
  return hasRole(user, ["ADMIN", "MANAGER"]);
}

/**
 * Resource access: ADMIN/MANAGER may access any resource;
 * REP may access only resources they own (ownerId match).
 */
export function canAccessResource(
  user: Pick<AuthUser, "id" | "role">,
  resourceOwnerId: string | number | null | undefined,
): boolean {
  if (hasRole(user, ["ADMIN", "MANAGER"])) return true;
  if (resourceOwnerId == null || resourceOwnerId === "") return false;
  return String(user.id) === String(resourceOwnerId);
}

/** High-privilege ops (delete deal/account, destructive exports) — ADMIN only. */
export function canPerformHighPrivilegeAction(user: Pick<AuthUser, "role">): boolean {
  return isAdmin(user);
}

export function canUpdateDealStage(user: Pick<AuthUser, "role">): boolean {
  return hasRole(user, ["ADMIN", "MANAGER", "REP"]);
}
