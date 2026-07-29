import { normalizeCompanyDomain } from "@/lib/company-domain";
import { normalizePhoneNumber } from "@/lib/m365/phone-normalization";
import { fetchWebsitePages, normalizeWebsiteUrl } from "@/lib/discovery/website-fetch";
import {
  emptyStructuredGeo,
  enrichStructuredGeo,
  formatStructuredGeoLine,
  geoFromJsonLdPostalAddress,
  hasStructuredGeo,
  parseStructuredGeoAddress,
  type StructuredGeoAddress,
} from "@/lib/discovery/geo-address";
import type {
  DiscoveredCompany,
  DiscoveredContact,
  WebsiteDiscoveryResult,
} from "@/lib/discovery/types";
import type { Company } from "@/types/company";

const EMAIL_PATTERN =
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

const PHONE_PATTERN =
  /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{2,4}[\s.-]?\d{2,4}(?:[\s.-]?\d{2,4})?/g;

const NORWEGIAN_POSTAL_LINE =
  /\b(\d{4})\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s-]{2,})\b/;

const STREET_LINE =
  /\b([A-ZÆØÅA-Za-zæøå0-9][A-Za-zæøå0-9\s.,'-]{2,}?\d+[A-Za-z]?)\s*,\s*(\d{4})\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s-]+)/g;

const IGNORED_EMAIL_LOCAL = new Set([
  "noreply",
  "no-reply",
  "donotreply",
  "wordpress",
  "webmaster",
  "sentry",
]);

const COMPANY_EMAIL_PRIORITY = ["info", "kontakt", "contact", "post", "hello", "office"];

function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&([a-z]+);/gi, " ");
}

function stripTags(html: string): string {
  return decodeHtml(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " "))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const key = value.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(value.trim());
  }

  return result;
}

function extractMeta(html: string, property: string): string {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]?.trim()) return decodeHtml(match[1].trim());
  }

  return "";
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match?.[1] ? stripTags(match[1]) : "";
}

function extractJsonLd(html: string): unknown[] {
  const blocks: unknown[] = [];
  const pattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1]!) as unknown;
      blocks.push(parsed);
    } catch {
      // ignore invalid JSON-LD
    }
  }

  return blocks;
}

function flattenJsonLd(node: unknown, out: Record<string, unknown>[]): void {
  if (!node) return;

  if (Array.isArray(node)) {
    for (const item of node) flattenJsonLd(item, out);
    return;
  }

  if (typeof node !== "object") return;

  const record = node as Record<string, unknown>;
  out.push(record);

  if (record["@graph"]) flattenJsonLd(record["@graph"], out);
}

function collectEmails(html: string): string[] {
  const emails: string[] = [];

  for (const match of html.matchAll(/href=["']mailto:([^"'?]+)/gi)) {
    if (match[1]) emails.push(match[1].trim());
  }

  for (const match of html.matchAll(EMAIL_PATTERN)) {
    emails.push(match[0]);
  }

  return uniqueStrings(
    emails
      .map((email) => email.replace(/\s+/g, "").toLowerCase())
      .filter((email) => {
        const local = email.split("@")[0] ?? "";
        return !IGNORED_EMAIL_LOCAL.has(local);
      }),
  );
}

function collectPhones(html: string): string[] {
  const phones: string[] = [];

  for (const match of html.matchAll(/href=["']tel:([^"']+)/gi)) {
    if (match[1]) phones.push(decodeHtml(match[1]));
  }

  const text = stripTags(html);
  for (const match of text.matchAll(PHONE_PATTERN)) {
    const digits = match[0].replace(/\D/g, "");
    if (digits.length >= 8) phones.push(match[0].trim());
  }

  return uniqueStrings(phones.map((phone) => normalizePhoneNumber(phone)).filter(Boolean));
}

function scoreCompanyEmail(email: string): number {
  const local = email.split("@")[0] ?? "";
  const index = COMPANY_EMAIL_PRIORITY.indexOf(local);
  return index === -1 ? 10 : index;
}

function pickCompanyEmail(emails: string[], domain: string, personalLocals: Set<string>): string {
  const domainEmails = emails.filter((email) => email.endsWith(`@${domain}`));
  const pool = domainEmails.length > 0 ? domainEmails : emails;
  const general = pool.filter((email) => {
    const local = (email.split("@")[0] ?? "").toLowerCase();
    return !personalLocals.has(local);
  });
  const priority = general.filter((email) =>
    COMPANY_EMAIL_PRIORITY.includes((email.split("@")[0] ?? "").toLowerCase()),
  );
  if (priority.length > 0) {
    return priority.sort((a, b) => scoreCompanyEmail(a) - scoreCompanyEmail(b))[0]!;
  }
  return general[0] ?? "";
}

function pickCompanyPhone(phones: string[]): string {
  const landline = phones.find(
    (phone) => phone.startsWith("+47") && phone.replace(/\D/g, "").length <= 10,
  );
  return landline ?? phones[0] ?? "";
}

function extractJsonLdPostalAddresses(
  htmlPages: string[],
  domain: string,
): StructuredGeoAddress[] {
  const results: StructuredGeoAddress[] = [];

  for (const html of htmlPages) {
    for (const block of extractJsonLd(html)) {
      const nodes: Record<string, unknown>[] = [];
      flattenJsonLd(block, nodes);
      for (const node of nodes) {
        const type = node["@type"];
        const typeLabel = Array.isArray(type) ? type.join(" ") : String(type ?? "");
        if (/PostalAddress/i.test(typeLabel)) {
          const geo = geoFromJsonLdPostalAddress(node, domain);
          if (hasStructuredGeo(geo)) results.push(geo);
        }
        const nested = node.address;
        if (nested && typeof nested === "object" && !Array.isArray(nested)) {
          const geo = geoFromJsonLdPostalAddress(nested as Record<string, unknown>, domain);
          if (hasStructuredGeo(geo)) results.push(geo);
        }
      }
    }
  }

  return results;
}

function resolveDiscoveryGeo(
  htmlPages: string[],
  addressLines: string[],
  domain: string,
): StructuredGeoAddress {
  const fromJsonLd = extractJsonLdPostalAddresses(htmlPages, domain);
  if (fromJsonLd[0] && hasStructuredGeo(fromJsonLd[0])) {
    return fromJsonLd[0];
  }

  for (const line of addressLines) {
    const parsed = parseStructuredGeoAddress(line, domain);
    if (hasStructuredGeo(parsed)) return parsed;
  }

  return emptyStructuredGeo();
}

function companyWithGeo(
  base: Omit<
    DiscoveredCompany,
    | "streetAddress"
    | "postalCode"
    | "city"
    | "stateRegion"
    | "country"
    | "countryCode"
    | "continent"
  >,
  geo: StructuredGeoAddress,
): DiscoveredCompany {
  const address =
    base.address.trim() || formatStructuredGeoLine(geo) || "";

  return {
    ...base,
    address,
    streetAddress: geo.streetAddress,
    postalCode: geo.postalCode,
    city: geo.city,
    stateRegion: geo.stateRegion,
    country: geo.country,
    countryCode: geo.countryCode,
    continent: geo.continent,
  };
}

function extractAddressLines(html: string): string[] {
  const addresses: string[] = [];

  for (const match of html.matchAll(/elementor-icon-list-text[^>]*>([^<]+)</gi)) {
    const value = stripTags(match[1] ?? "").replace(/\s+/g, " ").trim();
    if (value.length > 80) continue;
    if (/,\s*\d{4}\s+[A-Za-zÀ-ÿ]/.test(value) || /^\d{4}\s+[A-Za-zÀ-ÿ]/.test(value)) {
      addresses.push(value);
    }
  }

  const text = stripTags(html);
  for (const match of text.matchAll(STREET_LINE)) {
    const line = `${match[1]?.trim()}, ${match[2]} ${match[3]?.trim()}`;
    if (line.length <= 80) addresses.push(line);
  }

  return uniqueStrings(addresses);
}

function inferCompanyName(htmlPages: string[], domain: string): string {
  for (const html of htmlPages) {
    for (const block of extractJsonLd(html)) {
      const nodes: Record<string, unknown>[] = [];
      flattenJsonLd(block, nodes);
      for (const node of nodes) {
        if (node["@type"] === "Organization" && typeof node.name === "string" && node.name.trim()) {
          return node.name.trim();
        }
      }
    }
  }

  const ogSite = htmlPages.map((html) => extractMeta(html, "og:site_name")).find(Boolean);
  if (ogSite) return ogSite;

  const title = htmlPages.map((html) => extractTitle(html)).find(Boolean) ?? "";
  const cleaned = title
    .replace(/\s*[-|–—]\s*.+$/u, "")
    .replace(/\s*:\s*.+$/u, "")
    .trim();

  if (cleaned && !isUnusableCompanyTitle(cleaned)) return cleaned;

  return companyNameFromDomain(domain);
}

/** Reject Apache/directory listings and empty website titles. */
export function isUnusableCompanyTitle(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return true;
  if (/^index of\b/.test(normalized)) return true;
  if (normalized === "/" || normalized === "home" || normalized === "untitled") return true;
  if (/^(welcome to|just a moment|access denied|403|404)\b/.test(normalized)) return true;
  return false;
}

/** ottem.no → Ottem */
export function companyNameFromDomain(domain: string): string {
  const host = normalizeCompanyDomain(domain);
  const base = (host.split(".")[0] ?? host).trim();
  if (!base) return "New Company";
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/**
 * Prefer a real company name; if discovery returned a website title like "Index of /",
 * fall back to a capitalized domain label (e.g. Ottem).
 */
export function resolveDiscoveryCompanyName(name: string, domain: string): string {
  const trimmed = name.trim();
  if (trimmed && !isUnusableCompanyTitle(trimmed)) return trimmed;
  return companyNameFromDomain(domain || name);
}

/** Sanitize discovery payload before persistence (name, domain, phone, geo). Client-safe. */
export function prepareDiscoveryForImport(
  discovery: WebsiteDiscoveryResult,
): WebsiteDiscoveryResult {
  const domain =
    normalizeCompanyDomain(discovery.company.domain) ||
    normalizeCompanyDomain(discovery.company.website) ||
    normalizeCompanyDomain(discovery.sourceUrl);
  const name = resolveDiscoveryCompanyName(discovery.company.name, domain);
  const phone = normalizePhoneNumber(discovery.company.phone);

  const fromFields = enrichStructuredGeo(
    {
      streetAddress: discovery.company.streetAddress,
      postalCode: discovery.company.postalCode,
      city: discovery.company.city,
      stateRegion: discovery.company.stateRegion,
      country: discovery.company.country,
      countryCode: discovery.company.countryCode,
      continent: discovery.company.continent,
    },
    domain,
  );

  const fromAddress = parseStructuredGeoAddress(discovery.company.address, domain);
  const geo = enrichStructuredGeo(
    {
      streetAddress: fromFields.streetAddress || fromAddress.streetAddress,
      postalCode: fromFields.postalCode || fromAddress.postalCode,
      city: fromFields.city || fromAddress.city,
      stateRegion: fromFields.stateRegion || fromAddress.stateRegion,
      country: fromFields.country || fromAddress.country,
      countryCode: fromFields.countryCode || fromAddress.countryCode,
      continent: fromFields.continent || fromAddress.continent,
    },
    domain,
  );

  return {
    ...discovery,
    company: companyWithGeo(
      {
        name,
        phone,
        email: discovery.company.email,
        website: domain || discovery.company.website,
        address: discovery.company.address || formatStructuredGeoLine(geo),
        domain,
      },
      geo,
    ),
  };
}

function extractImageBoxContacts(html: string): DiscoveredContact[] {
  const contacts: DiscoveredContact[] = [];
  const pattern =
    /elementor-image-box-title[^>]*>([^<]+)<\/h[1-6]>[\s\S]{0,400}?elementor-image-box-description[^>]*>([^<]+)<\/p>/gi;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const name = stripTags(match[1] ?? "");
    const jobTitle = stripTags(match[2] ?? "");
    if (!name || name.length < 4) continue;
    if (!/[A-ZÆØÅ]/.test(name)) continue;

    const tail = html.slice(match.index, match.index + 900);
    const emails = collectEmails(tail);
    const phones = collectPhones(tail);

    contacts.push({
      id: `contact-${contacts.length + 1}`,
      name,
      jobTitle,
      email: emails.find((email) => email.includes(name.split(/\s+/)[0]!.toLowerCase())) ?? emails[0] ?? "",
      phone: phones[0] ?? "",
    });
  }

  return contacts;
}

function extractEmailNamedContacts(html: string, domain: string): DiscoveredContact[] {
  const contacts: DiscoveredContact[] = [];

  for (const email of collectEmails(html)) {
    if (!email.endsWith(`@${domain}`) && !email.endsWith(`@${domain.replace(/^www\./, "")}`)) continue;

    const local = email.split("@")[0] ?? "";
    if (COMPANY_EMAIL_PRIORITY.includes(local)) continue;

    const nameParts = local
      .split(/[._-]/)
      .filter((part) => part.length > 1)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase());

    if (nameParts.length === 0) continue;

    const name = nameParts.join(" ");
    if (contacts.some((contact) => contact.name.toLowerCase() === name.toLowerCase())) continue;

    contacts.push({
      id: `email-${contacts.length + 1}`,
      name,
      jobTitle: "",
      email,
      phone: "",
    });
  }

  return contacts;
}

function mergeContacts(primary: DiscoveredContact[], secondary: DiscoveredContact[]): DiscoveredContact[] {
  const byName = new Map<string, DiscoveredContact>();

  for (const contact of [...primary, ...secondary]) {
    const key = contact.name.toLowerCase();
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, contact);
      continue;
    }

    byName.set(key, {
      ...existing,
      jobTitle: existing.jobTitle || contact.jobTitle,
      email: existing.email || contact.email,
      phone: existing.phone || contact.phone,
    });
  }

  return [...byName.values()];
}

function dedupeContacts(contacts: DiscoveredContact[]): DiscoveredContact[] {
  const withFullName = contacts.filter((contact) => contact.name.includes(" "));

  const filtered = contacts.filter((contact) => {
    if (!contact.name.includes(" ")) {
      const first = contact.name.toLowerCase();
      if (withFullName.some((entry) => entry.name.toLowerCase().startsWith(`${first} `))) {
        return false;
      }
      if (
        withFullName.some((entry) => {
          const local = entry.email.split("@")[0]?.toLowerCase() ?? "";
          return local.startsWith(first);
        })
      ) {
        return false;
      }
    }
    return true;
  });

  return filtered.map((contact, index) => ({
    ...contact,
    id: `contact-${index + 1}`,
  }));
}

function parseCityFromAddress(address: string): string {
  const postalMatch = address.match(NORWEGIAN_POSTAL_LINE);
  if (postalMatch?.[2]) return postalMatch[2].trim();
  const parts = address.split(",").map((part) => part.trim());
  return parts[parts.length - 1] ?? "";
}

export function analyzeWebsiteHtml(
  sourceUrl: string,
  pages: { url: string; html: string }[],
): WebsiteDiscoveryResult {
  const normalizedUrl = normalizeWebsiteUrl(sourceUrl);
  const domain = normalizeCompanyDomain(normalizedUrl);
  const htmlPages = pages.map((page) => page.html);
  const combinedHtml = htmlPages.join("\n");

  const emails = collectEmails(combinedHtml);
  const phones = collectPhones(combinedHtml);
  const addresses = extractAddressLines(combinedHtml);
  const companyName = inferCompanyName(htmlPages, domain);
  const geo = resolveDiscoveryGeo(htmlPages, addresses, domain);

  const imageBoxContacts = htmlPages.flatMap((html) => extractImageBoxContacts(html));
  const personalLocals = new Set(
    imageBoxContacts
      .flatMap((contact) => {
        const parts = contact.name.toLowerCase().split(/\s+/);
        const emailLocal = contact.email.split("@")[0]?.toLowerCase() ?? "";
        return emailLocal ? [...parts, emailLocal] : parts;
      })
      .filter((part) => part.length > 2),
  );

  const company = companyWithGeo(
    {
      name: companyName,
      phone: pickCompanyPhone(phones),
      email: pickCompanyEmail(emails, domain, personalLocals),
      website: domain,
      address: addresses[0] ?? formatStructuredGeoLine(geo),
      domain,
    },
    geo,
  );

  const contacts = dedupeContacts(
    mergeContacts(imageBoxContacts, extractEmailNamedContacts(combinedHtml, domain)),
  );

  return {
    sourceUrl: normalizedUrl,
    company,
    contacts,
    matchedCompanyId: null,
    matchedCompanyName: null,
    pagesAnalyzed: pages.map((page) => page.url),
  };
}

export async function discoverWebsite(
  inputUrl: string,
  companies: Company[] = [],
): Promise<WebsiteDiscoveryResult> {
  const { pages } = await fetchWebsitePages(inputUrl);

  if (pages.length === 0) {
    throw new Error("Unable to fetch website content. Check the URL and try again.");
  }

  const result = analyzeWebsiteHtml(inputUrl, pages);
  const domain = result.company.domain;
  const matched = companies.find(
    (company) => normalizeCompanyDomain(company.Domain) === domain,
  );

  if (matched) {
    result.matchedCompanyId = matched.CompanyID;
    result.matchedCompanyName = matched.Title;
  }

  return result;
}

export function discoveryToCompanyCity(result: WebsiteDiscoveryResult): string {
  return (
    result.company.city.trim() ||
    parseCityFromAddress(result.company.address) ||
    "—"
  );
}
