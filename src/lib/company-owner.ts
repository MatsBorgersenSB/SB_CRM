import type { Activity } from "@/types/activity";
import type { AuthUser } from "@/types/auth";
import type { Company, SharePointPerson } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import { STANDARD_BIO_USERS } from "@/types/bio-user";
import { resolveActivityCompany } from "@/lib/activity-utils";

const CANONICAL_USER_EMAILS: Record<number, string> = {
  1: "mats.borgersen@standard.bio",
  100: "walter.aker@standard.bio",
  101: "hugo.jansson@standard.bio",
  102: "okr@standard.bio",
  103: "bjorn.molskred@standard.bio",
};

const PLACEHOLDER_SSO_USER_ID = 1;

export type ColleagueOwnerRecord = {
  id: number;
  email: string;
  displayName: string;
};

export function seedColleagueDirectory(): ColleagueOwnerRecord[] {
  return STANDARD_BIO_USERS.map((bioUser) => ({
    id: bioUser.Id,
    email: CANONICAL_USER_EMAILS[bioUser.Id] ?? "",
    displayName: bioUser.Title,
  }));
}

function compactName(value: string): string {
  return value.toLowerCase().replace(/[^a-z]/g, "");
}

/** Email → name → id>0. Never let placeholder id 1 steal Mats from another colleague. */
export function matchColleagueOwner(
  identity: { email?: string | null; displayName?: string | null; id?: number | null },
  colleagues: ColleagueOwnerRecord[],
): SharePointPerson | null {
  const email = identity.email?.trim().toLowerCase() ?? "";
  if (email && !email.endsWith("@smartcrm.local")) {
    const byEmail = colleagues.find(
      (entry) => entry.email.trim().toLowerCase() === email,
    );
    if (byEmail) return { Id: byEmail.id, Title: byEmail.displayName };
  }

  const name = identity.displayName?.trim().toLowerCase() ?? "";
  if (name && name !== "guest") {
    const byName = colleagues.find(
      (entry) => entry.displayName.trim().toLowerCase() === name,
    );
    if (byName) return { Id: byName.id, Title: byName.displayName };
  }

  const local = email.split("@")[0] ?? "";
  const compactLocal = compactName(local);
  if (compactLocal) {
    const byCompact = colleagues.find(
      (entry) => compactName(entry.displayName) === compactLocal,
    );
    if (byCompact) return { Id: byCompact.id, Title: byCompact.displayName };
  }

  const id = identity.id;
  if (id == null || !Number.isFinite(id) || id <= 0) return null;
  const byId = colleagues.find((entry) => entry.id === id);
  if (!byId) return null;

  const emailConflicts = Boolean(email) && byId.email && byId.email.toLowerCase() !== email;
  const nameConflicts =
    Boolean(name) &&
    name !== "guest" &&
    byId.displayName.toLowerCase() !== name &&
    compactName(byId.displayName) !== compactName(name);
  if (emailConflicts || nameConflicts) return null;

  return { Id: byId.id, Title: byId.displayName };
}

export function authUserToAccountOwner(user: AuthUser): SharePointPerson {
  const matched = matchColleagueOwner(
    { email: user.email, displayName: user.displayName, id: user.id },
    seedColleagueDirectory(),
  );
  if (matched) return matched;

  const display = user.displayName?.trim() ?? "";
  if (display && display.toLowerCase() !== "guest") {
    const id = user.id > 0 && user.id !== PLACEHOLDER_SSO_USER_ID ? user.id : 0;
    return { Id: id, Title: display };
  }

  return { Id: 0, Title: display || "Guest" };
}

export function isCompanyOwnedByUser(company: Company, user: AuthUser): boolean {
  const owner = company.AccountOwner?.Title?.trim();
  if (!owner) return false;
  return owner.toLowerCase() === user.displayName.toLowerCase();
}

export function hasCompanyOwner(company: Company): boolean {
  return Boolean(formatAccountOwnerDisplay(company.AccountOwner));
}

export function hasContactOwner(contact: {
  ContactOwner?: SharePointPerson | null;
}): boolean {
  return Boolean(formatAccountOwnerDisplay(contact.ContactOwner));
}

/** Persist SharePoint-shaped people onto Prisma ownerId. */
export function ownerIdFromPerson(owner: SharePointPerson | null | undefined): string | null {
  if (owner == null) return null;
  if (typeof owner.Id === "number" && Number.isFinite(owner.Id) && owner.Id > 0) {
    return String(owner.Id);
  }
  return null;
}

/** Map a stored Prisma ownerId back to a person. Unknown ids are kept so a change is not dropped. */
export function personFromStoredOwnerId(
  ownerId: string | null | undefined,
): SharePointPerson | null {
  if (!ownerId) return null;
  if (ownerId.trim().toLowerCase() === "system") return null;

  const numeric = Number(ownerId);
  if (Number.isFinite(numeric) && numeric > 0) {
    const known = STANDARD_BIO_USERS.find((user) => user.Id === numeric);
    if (known) return { Id: known.Id, Title: known.Title };
    return { Id: numeric, Title: "" };
  }

  if (/[A-Za-z]/.test(ownerId) && !/^\d+$/.test(ownerId.trim())) {
    return { Id: 0, Title: ownerId.trim() };
  }

  return null;
}

export function enrichOwnerFromDirectory(
  owner: SharePointPerson | null | undefined,
  colleagues: ColleagueOwnerRecord[],
): SharePointPerson | null {
  if (!owner) return null;
  const matched = matchColleagueOwner(
    {
      id: owner.Id > 0 ? owner.Id : null,
      displayName: owner.Title,
      email: null,
    },
    colleagues,
  );
  if (matched) return matched;
  if (owner.Title?.trim() || owner.Id > 0) return owner;
  return null;
}

/** Display name for Account Owner — never show raw ids. */
export function formatAccountOwnerDisplay(
  owner: SharePointPerson | null | undefined,
): string | null {
  const title = owner?.Title?.trim();
  if (title && !/^\d+$/.test(title)) return title;
  if (owner?.Id) {
    const known = STANDARD_BIO_USERS.find((user) => user.Id === owner.Id);
    if (known) return known.Title;
  }
  return null;
}

export function buildCompanyOwnerOptions(
  companies: Company[],
  currentOwner?: SharePointPerson | null,
  extraUsers: SharePointPerson[] = [],
): SharePointPerson[] {
  const byId = new Map<number, SharePointPerson>();

  for (const user of STANDARD_BIO_USERS) {
    byId.set(user.Id, user);
  }

  for (const extra of extraUsers) {
    if (extra.Title?.trim()) byId.set(extra.Id, extra);
  }

  for (const company of companies) {
    const owner = company.AccountOwner;
    if (owner?.Title) {
      byId.set(owner.Id, owner);
    }
  }

  if (currentOwner?.Title && !byId.has(currentOwner.Id)) {
    byId.set(currentOwner.Id, currentOwner);
  }

  return Array.from(byId.values()).sort((a, b) => a.Title.localeCompare(b.Title));
}

/** True when Account Owner identity actually changed — used for audit, not cascade. */
export function accountOwnerChanged(
  previous: SharePointPerson | null | undefined,
  next: SharePointPerson | null | undefined,
): boolean {
  return (previous?.Id ?? null) !== (next?.Id ?? null)
    || (previous?.Title?.trim() || "") !== (next?.Title?.trim() || "");
}

export function resolveAccountOwner(
  explicit: SharePointPerson | null | undefined,
  fallbackUser: AuthUser,
): SharePointPerson;
export function resolveAccountOwner(
  explicit: SharePointPerson | null | undefined,
  fallbackUser?: AuthUser | null,
): SharePointPerson | null;
export function resolveAccountOwner(
  explicit: SharePointPerson | null | undefined,
  fallbackUser?: AuthUser | null,
): SharePointPerson | null {
  if (explicit?.Title?.trim()) {
    return explicit;
  }
  if (fallbackUser) {
    return authUserToAccountOwner(fallbackUser);
  }
  return null;
}

export function resolveOwnerById(
  ownerId: number,
  companies: Company[],
  currentOwner?: SharePointPerson | null,
  extraUsers: SharePointPerson[] = [],
): SharePointPerson | null {
  return (
    buildCompanyOwnerOptions(companies, currentOwner, extraUsers).find(
      (owner) => owner.Id === ownerId,
    ) ?? null
  );
}

export function resolveSmartAssistPortfolio(
  companies: Company[],
  pipelines: PipelineRow[],
  activities: Activity[],
  user: AuthUser,
): {
  companies: Company[];
  pipelines: PipelineRow[];
  activities: Activity[];
  ownedCompanyIds: Set<string>;
} {
  const ownedCompanyIds = new Set(
    companies.filter((company) => isCompanyOwnedByUser(company, user)).map((c) => c.CompanyID),
  );

  const portfolioScoped =
    user.role === "commercial" || user.role === "engineer"
      ? companies.filter((company) => ownedCompanyIds.has(company.CompanyID))
      : companies;

  const portfolioIds = new Set(portfolioScoped.map((company) => company.CompanyID));

  return {
    companies: portfolioScoped,
    pipelines: pipelines.filter((pipeline) => {
      const company = companies.find((record) => record.pipelineIds.includes(pipeline.id));
      // Reality First — never keep opportunities without a live company.
      return company ? portfolioIds.has(company.CompanyID) : false;
    }),
    activities: activities.filter((activity) => {
      const company = resolveActivityCompany(activity, companies);
      // Reality First — drop seed/orphan activities whose company is gone.
      if (!company) return false;
      return portfolioIds.has(company.CompanyID);
    }),
    ownedCompanyIds,
  };
}
