import "server-only";

import { auth } from "@/lib/auth";
import {
  resolveAccountOwner,
} from "@/lib/company-owner";
import { resolveAuditActor } from "@/lib/security/audit-logger";
import type { AuthUser, UserRole } from "@/types/auth";
import type { SharePointPerson } from "@/types/company";

function isPlaceholderEmail(email: string | undefined): boolean {
  return !email || email.endsWith("@smartcrm.local");
}

/** Signed-in colleague who is registering or changing a company. */
export async function resolveRequestAuthUser(
  request: Request,
  role: UserRole,
): Promise<AuthUser> {
  const actor = resolveAuditActor(request, role);
  let sessionName = "";
  let sessionEmail = "";
  try {
    const session = await auth();
    sessionName = session?.user?.name?.trim() || "";
    sessionEmail = session?.user?.email?.trim() || "";
  } catch {
    /* auth unavailable — headers / explicit owner still apply */
  }

  const email = isPlaceholderEmail(actor.userEmail) ? sessionEmail : actor.userEmail;
  const displayName = actor.userName?.trim() || sessionName || "";
  const parsedId = Number(actor.userId);
  const id =
    Number.isFinite(parsedId) && parsedId > 0 && !actor.userId.startsWith("role:")
      ? parsedId
      : 0;

  return {
    id,
    displayName: displayName || email || "Microsoft 365 user",
    email: email || undefined,
    role,
  };
}

/**
 * Default Account Owner = the person registering the company.
 * An explicit picker value always wins.
 */
export async function resolveRegistrarAccountOwner(
  request: Request,
  role: UserRole,
  explicit?: SharePointPerson | null,
): Promise<SharePointPerson> {
  const user = await resolveRequestAuthUser(request, role);
  return resolveAccountOwner(explicit, user);
}
