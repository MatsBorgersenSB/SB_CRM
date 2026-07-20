import { readActiveAssignableUsers } from "@/lib/users-access-db";
import type { StandardBioUserRecord } from "@/types/user-access";

/** Server-only — active SmartCRM users eligible for project team assignment. */
export async function readAssignableStandardBioUsers(): Promise<StandardBioUserRecord[]> {
  return readActiveAssignableUsers();
}
