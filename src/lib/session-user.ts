import type { Session } from "next-auth";
import { authUserToAccountOwner } from "@/lib/company-owner";
import type { AuthUser, UserRole } from "@/types/auth";
import { isUserRole } from "@/types/auth";

export const GUEST_USER: AuthUser = {
  id: 0,
  displayName: "Guest",
  role: "commercial",
};

/**
 * Single mapping from an Auth.js session to the app user. Used on the server
 * (so the first paint already knows who is signed in) and on the client.
 */
export function sessionToAuthUser(
  session: Session | null | undefined,
  current?: AuthUser,
): AuthUser {
  if (!session?.user) return GUEST_USER;

  const sessionRole = session.user.role;
  const role: UserRole =
    sessionRole && isUserRole(sessionRole) ? sessionRole : "commercial";
  const displayName =
    session.user.name?.trim() || session.user.email?.trim() || "Microsoft 365 user";
  const email = session.user.email?.trim() || undefined;
  const owner = authUserToAccountOwner({ id: 0, displayName, email, role });

  return {
    id: owner.Id,
    displayName: owner.Title || displayName,
    email,
    image: session.user.image ?? null,
    role,
    companyId: role === "client_lead" ? (current?.companyId ?? "CO-1001") : undefined,
  };
}
