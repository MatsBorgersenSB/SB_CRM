import type { UserRole } from "@/types/auth";
import { isUserRole } from "@/types/auth";

export const AUTH_ROLE_HEADER = "x-sb-user-role";

/**
 * Fail-closed default access tier when the role header is missing/invalid.
 * Maps to enterprise Role `REP` via `toEnterpriseRole` — never superuser/admin.
 */
export const UNAUTHENTICATED_DEFAULT_ROLE: UserRole = "engineer";

export function getRequestRole(request: Request): UserRole {
  const header = request.headers.get(AUTH_ROLE_HEADER);
  if (header && isUserRole(header)) {
    return header;
  }
  return UNAUTHENTICATED_DEFAULT_ROLE;
}

/** Browser/API fetch headers that carry the active access tier. */
export function withAuthRoleHeaders(
  role: UserRole,
  headers: HeadersInit = {},
): HeadersInit {
  return {
    ...headers,
    [AUTH_ROLE_HEADER]: role,
  };
}
