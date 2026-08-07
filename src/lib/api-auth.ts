import { auth } from "@/lib/auth";
import type { UserRole } from "@/types/auth";
import { isUserRole } from "@/types/auth";

export const AUTH_ROLE_HEADER = "x-sb-user-role";

/**
 * Fail-closed default when neither header nor session role is available.
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

/**
 * Prefer explicit role header; otherwise use the signed-in session access role.
 * Use this in mutating company/contact/deal routes so browser clients that
 * forget the header still authorize correctly after SSO.
 */
export async function resolveRequestRole(request: Request): Promise<UserRole> {
  const header = request.headers.get(AUTH_ROLE_HEADER);
  if (header && isUserRole(header)) {
    return header;
  }

  try {
    const session = await auth();
    const sessionRole = session?.user?.role;
    if (sessionRole && isUserRole(sessionRole)) {
      return sessionRole;
    }
  } catch {
    /* auth unavailable — fall through */
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
