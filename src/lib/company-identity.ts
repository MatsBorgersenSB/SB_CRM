import type { Company, CompanyIndustry, SharePointPerson } from "@/types/company";
import type { CompanyType } from "@/types/company-type";
import { resolveOwnerById } from "@/lib/company-owner";
import { normalizeCompanyTypes } from "@/lib/company-classification";
import { formatCompanyWebsite, normalizeCompanyDomain } from "@/lib/company-domain";
import { normalizePhoneNumber } from "@/lib/m365/phone-normalization";
import type { UpdateCompanyPatch } from "@/lib/pipeline-db";

const POSTAL_CITY_PATTERN = /^\d{4,6}\s+[A-Za-zÀ-ÿ]/;

const COUNTRY_PATTERN =
  /^(norway|sweden|denmark|finland|germany|spain|france|netherlands|belgium|austria|switzerland|portugal|italy|poland|uk|united kingdom|usa|united states|canada|ireland)$/i;

/** Decode URL-encoded phones (%20) and normalize for display. */
export function decodePhoneForDisplay(phone: string | null | undefined): string {
  let value = (phone ?? "").trim();
  if (!value) return "";
  try {
    if (/%[0-9A-Fa-f]{2}/.test(value)) {
      value = decodeURIComponent(value);
    }
  } catch {
    value = value.replace(/%20/gi, " ");
  }
  return normalizePhoneNumber(value) || value.replace(/\s+/g, " ").trim();
}

export type CompanyHeroIdentityView = {
  companyName: string;
  industry: string;
  parentCompany: string;
  mainPhone: string;
  mainEmail: string;
  website: string;
  address: string;
};

export type CompanyHeroQuickEdit = {
  Title: string;
  Industry: CompanyIndustry;
  parentCompanyId: string;
  accountOwnerId: number;
  Phone: string;
  Email: string;
  Domain: string;
  streetAddress: string;
  postalCode: string;
  city: string;
  stateRegion: string;
  country: string;
  countryCode: string;
  continent: string;
  CompanyTypes: CompanyType[];
  tagsInput: string;
  Notes: string;
};

export function formatCompanyAddress(
  company: Pick<Company, "AddressLine1" | "AddressLine2" | "PostalCode" | "City" | "Country">,
): string {
  const lines: string[] = [];

  for (const line of company.AddressLine1.split("\n")) {
    const trimmed = line.trim();
    if (trimmed) lines.push(trimmed);
  }

  if (company.AddressLine2.trim()) {
    lines.push(company.AddressLine2.trim());
  }

  const postalCity = [company.PostalCode.trim(), company.City.trim()]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (postalCity && !lines.includes(postalCity)) {
    lines.push(postalCity);
  }

  const country = company.Country?.Title?.trim() ?? "";
  if (country && !lines.some((line) => line.toLowerCase() === country.toLowerCase())) {
    lines.push(country);
  }

  return lines.join("\n");
}

export function parseCompanyAddressInput(address: string): Pick<
  Company,
  "AddressLine1" | "AddressLine2" | "PostalCode" | "City" | "Country"
> {
  const lines = address
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const remaining = [...lines];

  let country: Company["Country"] = null;
  if (remaining.length > 0 && COUNTRY_PATTERN.test(remaining[remaining.length - 1]!)) {
    const title = remaining.pop()!;
    country = { Id: 0, Title: title };
  }

  let postalCode = "";
  let city = "";
  if (remaining.length > 0 && POSTAL_CITY_PATTERN.test(remaining[remaining.length - 1]!)) {
    const postalLine = remaining.pop()!;
    const match = postalLine.match(/^(\d{4,6})\s+(.+)$/);
    if (match?.[1] && match[2]) {
      postalCode = match[1];
      city = match[2];
    }
  }

  return {
    AddressLine1: remaining.join("\n"),
    AddressLine2: "",
    PostalCode: postalCode,
    City: city,
    Country: country,
  };
}

export function buildCompanyHeroIdentity(company: Company): CompanyHeroIdentityView {
  return {
    companyName: company.Title,
    industry: company.Industry,
    parentCompany: company.ParentCompany?.Title ?? "—",
    mainPhone: decodePhoneForDisplay(company.Phone),
    mainEmail: (company.Email ?? "").trim(),
    website: formatCompanyWebsite(company.Domain),
    address: formatCompanyAddress(company),
  };
}

export function buildCompanyHeroQuickEdit(company: Company): CompanyHeroQuickEdit {
  return {
    Title: company.Title,
    Industry: company.Industry,
    parentCompanyId: company.ParentCompany ? String(company.ParentCompany.Id) : "",
    accountOwnerId: company.AccountOwner?.Id ?? 0,
    Phone: company.Phone.trim(),
    Email: (company.Email ?? "").trim(),
    Domain: company.Domain.trim(),
    streetAddress: company.AddressLine1 ?? "",
    postalCode: company.PostalCode ?? "",
    city: company.City ?? "",
    stateRegion: company.stateRegion ?? "",
    country: company.Country?.Title?.trim() ?? "",
    countryCode: company.countryCode ?? "",
    continent: company.continent ?? "",
    CompanyTypes: normalizeCompanyTypes(company),
    tagsInput: formatTagsInput(company.Tags),
    Notes: (company.Notes ?? "").trim(),
  };
}

export function resolveParentCompanyLookup(
  parentCompanyId: string,
  companies: Company[],
): Company["ParentCompany"] {
  if (!parentCompanyId.trim()) return null;

  const parent = companies.find((record) => String(record.id) === parentCompanyId);
  if (!parent) return null;

  return { Id: parent.id, Title: parent.Title };
}

export function companyHeroQuickEditToPatch(
  edit: CompanyHeroQuickEdit,
  companies: Company[],
  currentOwner?: SharePointPerson | null,
): UpdateCompanyPatch {
  const accountOwner = resolveOwnerById(edit.accountOwnerId, companies, currentOwner);

  return {
    Title: edit.Title.trim(),
    Industry: edit.Industry,
    ParentCompany: resolveParentCompanyLookup(edit.parentCompanyId, companies),
    AccountOwner: accountOwner ?? undefined,
    Phone: normalizePhoneNumber(edit.Phone),
    Email: edit.Email.trim().toLowerCase(),
    Domain: normalizeCompanyDomain(edit.Domain),
    CompanyTypes: edit.CompanyTypes,
    Tags: parseTagsInput(edit.tagsInput),
    Notes: edit.Notes.trim(),
    AddressLine1: edit.streetAddress.trim(),
    AddressLine2: "",
    PostalCode: edit.postalCode.trim(),
    City: edit.city.trim(),
    Country: edit.country.trim() ? { Id: 0, Title: edit.country.trim() } : null,
    stateRegion: edit.stateRegion.trim() || undefined,
    countryCode: edit.countryCode.trim() || undefined,
    continent: edit.continent.trim() || undefined,
  };
}

export function companyWebsiteHref(domain: string): string {
  const trimmed = domain.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function parseTagsInput(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function formatTagsInput(tags: string[] | undefined): string {
  return (tags ?? []).join(", ");
}
