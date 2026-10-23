import { AUTH_ROLE_HEADER, isUserRole } from "@/types/auth";

/**
 * The role header is a server-to-route channel, NOT client input.
 * Middleware calls this on every request: whatever the browser sent is
 * discarded, and the role is rewritten from the verified session token.
 */
export function applyTrustedRoleHeader(
  headers: Headers,
  tokenAccessRole: unknown,
): void {
  headers.delete(AUTH_ROLE_HEADER);
  if (typeof tokenAccessRole === "string" && isUserRole(tokenAccessRole)) {
    headers.set(AUTH_ROLE_HEADER, tokenAccessRole);
  }
}
