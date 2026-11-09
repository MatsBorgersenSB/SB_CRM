import "server-only";

import { auth } from "@/lib/auth";
import {
  authUserToAccountOwner,
  enrichOwnerFromDirectory,
  matchColleagueOwner,
  seedColleagueDirectory,
  type ColleagueOwnerRecord,
} from "@/lib/company-owner";
import { resolveAuditActor } from "@/lib/security/audit-logger";
import { readUsers } from "@/lib/users-access-db";
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

async function colleagueDirectory(): Promise<ColleagueOwnerRecord[]> {
  const registered = await readUsers().catch(() => []);
  const fromAccess: ColleagueOwnerRecord[] = registered
    .filter((entry) => entry.status === "active")
    .map((entry) => ({
      id: entry.id,
      email: entry.email,
      displayName: entry.displayName,
    }));

  const byId = new Map<number, ColleagueOwnerRecord>();
  for (const row of [...fromAccess, ...seedColleagueDirectory()]) {
    if (!byId.has(row.id)) byId.set(row.id, row);
  }
  return Array.from(byId.values());
}

export async function enrichStoredOwner(
  owner: SharePointPerson | null | undefined,
): Promise<SharePointPerson | null> {
  const directory = await colleagueDirectory();
  return enrichOwnerFromDirectory(owner ?? null, directory);
}

export async function enrichCompanyOwners<
  T extends {
    AccountOwner?: SharePointPerson | null;
    contacts?: Array<{ ContactOwner?: SharePointPerson | null }>;
  },
>(company: T): Promise<T> {
  const directory = await colleagueDirectory();
  return {
    ...company,
    AccountOwner: enrichOwnerFromDirectory(company.AccountOwner ?? null, directory),
    contacts: (company.contacts ?? []).map((contact) => ({
      ...contact,
      ContactOwner: enrichOwnerFromDirectory(contact.ContactOwner ?? null, directory),
    })),
  };
}

export async function enrichCompaniesOwners<
  T extends {
    AccountOwner?: SharePointPerson | null;
    contacts?: Array<{ ContactOwner?: SharePointPerson | null }>;
  },
>(companies: T[]): Promise<T[]> {
  const directory = await colleagueDirectory();
  return companies.map((company) => ({
    ...company,
    AccountOwner: enrichOwnerFromDirectory(company.AccountOwner ?? null, directory),
    contacts: (company.contacts ?? []).map((contact) => ({
      ...contact,
      ContactOwner: enrichOwnerFromDirectory(contact.ContactOwner ?? null, directory),
    })),
  }));
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
  const directory = await colleagueDirectory();
  if (explicit && (explicit.Title?.trim() || explicit.Id > 0)) {
    const matchedExplicit = matchColleagueOwner(
      {
        email: null,
        displayName: explicit.Title,
        id: explicit.Id > 0 ? explicit.Id : null,
      },
      directory,
    );
    if (matchedExplicit) return matchedExplicit;
    if (explicit.Title?.trim()) return explicit;
  }

  const matched = matchColleagueOwner(
    {
      email: user.email,
      displayName: user.displayName,
      id: user.id > 0 ? user.id : null,
    },
    directory,
  );
  if (matched) return matched;

  const fromSession = authUserToAccountOwner(user);
  if (fromSession.Title.trim() && fromSession.Title.toLowerCase() !== "guest") {
    return fromSession;
  }

  return fromSession;
}
