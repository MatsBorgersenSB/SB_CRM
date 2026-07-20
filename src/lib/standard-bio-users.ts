import type { SharePointPerson } from "@/types/company";
import { STANDARD_BIO_USERS } from "@/types/bio-user";
import type { StandardBioUserRecord } from "@/types/user-access";

/** Client-safe conversion — mirrors users-access-db userToSharePointPerson. */
export function standardBioUserToOption(
  user: Pick<StandardBioUserRecord, "id" | "displayName">,
): SharePointPerson {
  return { Id: user.id, Title: user.displayName };
}

/** Convert user records to SharePoint-style picker options (Id = user.id). */
export function standardBioUserRecordsToOptions(
  users: StandardBioUserRecord[],
): SharePointPerson[] {
  return users.map(standardBioUserToOption);
}

/**
 * Merge registered users with legacy seed owners so pickers stay complete
 * when a project references someone outside the users registry.
 */
export function mergeStandardBioUserOptions(
  users: StandardBioUserRecord[],
  extras: SharePointPerson[] = [],
): SharePointPerson[] {
  const byId = new Map<number, SharePointPerson>();

  for (const user of users) {
    byId.set(user.id, standardBioUserToOption(user));
  }

  for (const legacy of STANDARD_BIO_USERS) {
    if (!byId.has(legacy.Id)) {
      byId.set(legacy.Id, legacy);
    }
  }

  for (const extra of extras) {
    if (extra.Title?.trim() && !byId.has(extra.Id)) {
      byId.set(extra.Id, extra);
    }
  }

  return Array.from(byId.values()).sort((a, b) => a.Title.localeCompare(b.Title));
}

export function findStandardBioUserOption(
  options: SharePointPerson[],
  userId?: number,
): SharePointPerson | undefined {
  if (userId === undefined) return undefined;
  return options.find((option) => option.Id === userId);
}
