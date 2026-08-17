/**
 * Standard Bio colleagues are SmartCRM users, not Contact Registry people.
 * Used by Outlook intake and every contact-create path.
 */

import { isInternalEmail } from "@/lib/domain-rules";
import { SharePointServiceError } from "@/services/sharepoint/client/errors";
import { readUsers } from "@/lib/users-access-db";

export const INTERNAL_CONTACT_REFUSED =
  "This person works at Standard Bio. They are a SmartCRM user, not a contact. Add them in Users & Access if they need a login.";

export type InternalColleague = {
  email: string;
  knownUser: boolean;
  displayName: string;
  userId: string | null;
  team: string | null;
  role: string | null;
};

export async function resolveInternalColleague(
  email: string,
): Promise<InternalColleague | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !isInternalEmail(normalized)) return null;

  const users = await readUsers();
  const user = users.find((row) => row.email.trim().toLowerCase() === normalized);

  if (user) {
    return {
      email: normalized,
      knownUser: true,
      displayName: user.displayName,
      userId: user.userId,
      team: user.team,
      role: user.role,
    };
  }

  return {
    email: normalized,
    knownUser: false,
    displayName: normalized.split("@")[0] ?? normalized,
    userId: null,
    team: null,
    role: null,
  };
}

/** Throws when the address belongs to Standard Bio (or another internal domain). */
export function assertExternalContactEmail(email: string | null | undefined): void {
  const normalized = email?.trim() ?? "";
  if (!normalized) return;
  if (!isInternalEmail(normalized)) return;
  throw SharePointServiceError.validation(INTERNAL_CONTACT_REFUSED);
}
