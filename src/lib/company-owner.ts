import type { Activity } from "@/types/activity";
import type { AuthUser } from "@/types/auth";
import type { Company, SharePointPerson } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import { STANDARD_BIO_USERS } from "@/types/bio-user";
import { resolveActivityCompany } from "@/lib/activity-utils";

export function authUserToAccountOwner(user: AuthUser): SharePointPerson {
  const display = user.displayName?.trim().toLowerCase() ?? "";
  const email = user.email?.trim().toLowerCase() ?? "";

  const matchByNameOrEmail = STANDARD_BIO_USERS.find((bioUser) => {
    if (display && display !== "guest" && bioUser.Title.toLowerCase() === display) {
      return true;
    }
    if (!email) return false;
    const local = email.split("@")[0] ?? "";
    const compactTitle = bioUser.Title.toLowerCase().replace(/[^a-z]/g, "");
    const compactLocal = local.replace(/[^a-z]/g, "");
    return Boolean(compactLocal && compactTitle && compactTitle === compactLocal);
  });
  // Name/email first — SSO sessions often share a placeholder id, so id must not steal ownership.
  const canonical =
    matchByNameOrEmail ??
    STANDARD_BIO_USERS.find((bioUser) => user.id > 0 && bioUser.Id === user.id);

  if (canonical) return canonical;

  // Signed-in users must never get Guest id 0 — fall back to primary Standard Bio owner.
  if (user.id <= 0 || display === "guest" || !display) {
    return STANDARD_BIO_USERS[0]!;
  }

  return { Id: user.id > 0 ? user.id : STANDARD_BIO_USERS[0]!.Id, Title: user.displayName };
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
  fallbackUser?: AuthUser | null,
): SharePointPerson {
  if (explicit?.Title?.trim()) {
    return explicit;
  }
  if (fallbackUser) {
    return authUserToAccountOwner(fallbackUser);
  }
  return STANDARD_BIO_USERS[0]!;
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
