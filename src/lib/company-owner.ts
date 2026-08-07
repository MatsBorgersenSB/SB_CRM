import type { Activity } from "@/types/activity";
import type { AuthUser } from "@/types/auth";
import type { Company, SharePointPerson } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import { STANDARD_BIO_USERS } from "@/types/bio-user";

export function authUserToAccountOwner(user: AuthUser): SharePointPerson {
  const display = user.displayName?.trim().toLowerCase() ?? "";
  const email = user.email?.trim().toLowerCase() ?? "";

  const canonical = STANDARD_BIO_USERS.find((bioUser) => {
    if (user.id > 0 && bioUser.Id === user.id) return true;
    if (display && bioUser.Title.toLowerCase() === display) return true;
    // Match "mats.borgersen@…" style emails to "Mats Borgersen"
    if (email) {
      const local = email.split("@")[0] ?? "";
      const compactTitle = bioUser.Title.toLowerCase().replace(/[^a-z]/g, "");
      const compactLocal = local.replace(/[^a-z]/g, "");
      if (compactLocal && compactTitle && compactLocal.includes(compactTitle.slice(0, 4))) {
        return compactTitle === compactLocal || compactLocal.startsWith(compactTitle.slice(0, 4));
      }
    }
    return false;
  });

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
  return Boolean(company.AccountOwner?.Title?.trim());
}

export function buildCompanyOwnerOptions(
  companies: Company[],
  currentOwner?: SharePointPerson | null,
): SharePointPerson[] {
  const byId = new Map<number, SharePointPerson>();

  for (const user of STANDARD_BIO_USERS) {
    byId.set(user.Id, user);
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
): SharePointPerson | null {
  return (
    buildCompanyOwnerOptions(companies, currentOwner).find((owner) => owner.Id === ownerId) ??
    null
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
      return company ? portfolioIds.has(company.CompanyID) : user.role === "superuser";
    }),
    activities: activities.filter((activity) => {
      if (!activity.Company) return user.role === "superuser";
      const companyRef = activity.Company;
      const company = companies.find((record) => {
        if ("CompanyID" in companyRef && companyRef.CompanyID) {
          return record.CompanyID === companyRef.CompanyID;
        }
        return record.id === companyRef.Id || record.Title === companyRef.Title;
      });
      return company ? portfolioIds.has(company.CompanyID) : user.role === "superuser";
    }),
    ownedCompanyIds,
  };
}
