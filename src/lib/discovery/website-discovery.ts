import { normalizeCompanyDomain } from "@/lib/company-domain";
import { resolveCountry } from "@/lib/geo/country-continent";
import { lookupAddressOSM } from "@/lib/geo/nominatim";
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

/** Prefer explicit international numbers (+47, +49, +33, …), including (+49) 0 52 77 / 95 393 – 0. */
const INTL_PHONE_PATTERN =
  /\(?\+(?:47|46|45|358|354|33|49|44|43|41|31|32|34|39|48|353|351|1)\)?[\s.-]*(?:\(?\d{1,5}\)?[\s./\u2013\u2014-]*){2,9}\d/g;

const PHONE_PATTERN =
  /(?:\(?\+?\d{1,3}\)?[\s.-]?)?(?:\(?\d{2,4}\)?[\s./-]?)?\d{2,4}[\s./\u2013\u2014-]?\d{2,4}(?:[\s./\u2013\u2014-]?\d{1,4})?/g;

const TEL_LABEL_PHONE =
  /(?:Tel\.?|Telefon|Tlf\.?|Phone|Mob\.?|Mobile)\s*[:.]?\s*(\(?\+?\d[\d\s()./\u2013\u2014-]{6,26}\d)/gi;

const POSTAL_CITY_LINE =
  /(?:^|(?<=[\s,]))(?:(?:DE|AT|CH|NO|SE|DK|FI|FR|BE|NL|IT|ES|PT|PL|D|A|N|S|F|B|I|E)-)?(\d{4,5}|\d{3}\s\d{2}|\d{2}-\d{3}|\d{4}\s?[A-Z]{2})\s+([A-ZÆØÅÄÖÜÀ-Ÿ][A-Za-zæøåäöüà-ÿß.'’-]{1,}(?:[\s-][A-Za-zæøåäöüà-ÿß.'’-]{2,}){0,3})(?=$|[\s,|/;(])/;

const NORWEGIAN_POSTAL_LINE =
  /\b(\d{4,5})\s+([A-ZÆØÅÄÖÜÀ-Ÿ][A-Za-zÀ-ÿ\s-]{2,})\b/;

const STREET_LINE =
  /\b([A-ZÆØÅÄÖÜA-Za-zæøåäöü0-9][A-Za-zæøåäöü0-9\s.,'-]{2,}?\d+[A-Za-z]?)\s*,\s*(\d{4,5})\s+([A-ZÆØÅÄÖÜÀ-Ÿ][A-Za-zÀ-ÿ\s-]+)/g;

/** House-number-first Nordic street: "5 Industrivegen" / "14 Industrigatan" */
const HOUSE_FIRST_STREET =
  /\b(\d{1,4}[A-Za-z]?)\s+([A-ZÆØÅÁÉÍÓÚÄÖÜ][A-Za-zæøåäöüà-ÿß'’-]{2,}(?:\s+[A-Za-zæøåäöüà-ÿß'’-]+){0,3})\b/;

const NORDIC_JOB_TITLE_HINT =
  /\b(daglig\s+leder|ceo|cfo|cto|coo|seniorrådgiver|senior\s*rådgiver|rådgiver|salgs-?\s*og\s*markedsføringssjef|salgssjef|markedsdirektør|direktør|manager|director|managing\s+director|founder|gründer|partner|engineer|ingeniør|konsulent|consultant|advisor|adviser|head\s+of|vp|president|geschäftsführ\w*|geschäftsleit\w*|prokurist\w*|leitung|leiter\w*|konstruktion|rechnungswesen|verwaltung|vertrieb\w*|einkauf|verkauf|meister|techniker|dokumentation|automatisierung|steuerung|ausbildung|projektleit\w*|directeur|gérant|responsable|direktör|vd|styreleder)\b/i;

const LANGUAGE_LINE =
  /^(norsk|engelsk|tysk|fransk|svensk|dansk|finsk|english|norwegian|german|french|swedish|danish|finnish|deutsch)(\s*\/\s*(norsk|engelsk|tysk|fransk|svensk|dansk|finsk|english|norwegian|german|french|swedish|danish|finnish|deutsch))*$/i;

const NON_CITY_WORD =
  /^(uhr|jahre|jahren|gmbh|ag|kg|ohg|ug|as|asa|ab|aps|oy|ltd|inc|llc|sarl|sas|bv|nv|euro|eur|usd|nok|sek|dkk|chf|tel|telefon|fax|telefax|mail|email|phone|mobil|mobile|bis|und|oder|von|mit|für|the|and|for|from|to|of|in|at|on|januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember|january|february|march|may|june|july|october|december)$/i;

const NON_STREET_LINE =
  /(@|https?:|www\.|\b(?:tel\.?|telefon|fax|telefax|phone|mail|e-mail|öffnungszeiten|opening\s+hours|betriebsferien|company\s+holidays|handelsregister|registergericht|umsatzsteuer|ust-?id|vat|org\.?\s*nr|hrb|hra|iban|bic|swift)\b|\b\d{1,2}\.\d{1,2}\.\d{2,4}\b|\b\d{1,2}:\d{2}\b)/i;

const IGNORED_EMAIL_LOCAL = new Set([
  "noreply",
  "no-reply",
  "donotreply",
  "wordpress",
  "webmaster",
  "sentry",
]);

const COMPANY_EMAIL_PRIORITY = [
  "info",
  "kontakt",
  "contact",
  "post",
  "hello",
  "office",
  "mail",
  "firmapost",
  "postmottak",
  "zentrale",
  "anfrage",
  "sales",
  "salg",
  "vertrieb",
  "enquiry",
  "enquiries",
  "general",
  "reception",
  "support",
  "service",
  "admin",
  "buero",
  "buro",
  "ansprechpartner",
];

const COMPANY_EMAIL_PRIORITY_SET = new Set(COMPANY_EMAIL_PRIORITY);

const ASSET_EXTENSION_PATTERN =
  /\.(?:png|jpe?g|gif|svg|webp|ico|css|js|mjs|woff2?|ttf|eot|pdf|zip|mp4|webm)$/i;

const OBFUSCATED_EMAIL_PATTERN =
  /\b([A-Z0-9._%+-]{1,64})\s*(?:\[at\]|\(at\)|\{at\}|\s+at\s+)\s*([A-Z0-9.-]+\.[A-Z]{2,})\b/gi;

const NAMED_HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  shy: "",
  auml: "ä",
  ouml: "ö",
  uuml: "ü",
  Auml: "Ä",
  Ouml: "Ö",
  Uuml: "Ü",
  szlig: "ß",
  aring: "å",
  Aring: "Å",
  oslash: "ø",
  Oslash: "Ø",
  aelig: "æ",
  AElig: "Æ",
  eacute: "é",
  Eacute: "É",
  egrave: "è",
  ecirc: "ê",
  aacute: "á",
  oacute: "ó",
  iacute: "í",
  uacute: "ú",
  ntilde: "ñ",
  ccedil: "ç",
  laquo: "«",
  raquo: "»",
  bull: "•",
  middot: "·",
  copy: "©",
  reg: "®",
};

function decodeHtml(text: string): string {
  return text
    .replace(/\u00AD/g, "")
    .replace(/&#(\d+);/g, (_, code) => {
      const num = Number(code);
      return num === 173 ? "" : String.fromCharCode(num);
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const num = parseInt(hex, 16);
      return num === 173 ? "" : String.fromCharCode(num);
    })
    .replace(/&([a-z]+);/gi, (full, entity: string) => {
      if (entity in NAMED_HTML_ENTITIES) return NAMED_HTML_ENTITIES[entity]!;
      const lower = entity.toLowerCase();
      if (lower in NAMED_HTML_ENTITIES) return NAMED_HTML_ENTITIES[lower]!;
      return " ";
    });
}

function stripTags(html: string): string {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " "),
  )
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Convert HTML into clean logical text lines, preserving <br> and block boundaries. */
function htmlToLines(html: string): string[] {
  const withoutNoise = html
    .replace(/<script[\s\S]*?<\/script>/gi, "\n")
    .replace(/<style[\s\S]*?<\/style>/gi, "\n")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "\n")
    .replace(/<svg[\s\S]*?<\/svg>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|li|tr|h[1-6]|address|section|article|footer|header|dt|dd|td|th)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  return decodeHtml(withoutNoise)
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
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

  for (const block of extractJsonLd(html)) {
    const nodes: Record<string, unknown>[] = [];
    flattenJsonLd(block, nodes);
    for (const node of nodes) {
      if (typeof node.email === "string" && node.email.trim()) {
        emails.push(decodeHtml(node.email.trim()).replace(/^mailto:/i, ""));
      }
    }
  }

  for (const match of html.matchAll(/href=["']\s*mailto:([^"'?]+)/gi)) {
    if (match[1]) emails.push(decodeHtml(match[1].trim()));
  }

  const decodedHtml = decodeHtml(html);
  for (const match of decodedHtml.matchAll(EMAIL_PATTERN)) {
    emails.push(match[0]);
  }

  const text = stripTags(html);
  for (const match of text.matchAll(OBFUSCATED_EMAIL_PATTERN)) {
    if (match[1] && match[2]) {
      emails.push(`${match[1]}@${match[2]}`);
    }
  }

  return uniqueStrings(
    emails
      .map((email) => email.replace(/\s+/g, "").toLowerCase())
      .filter((email) => {
        if (!email.includes("@")) return false;
        if (ASSET_EXTENSION_PATTERN.test(email)) return false;
        const local = email.split("@")[0] ?? "";
        return Boolean(local) && !IGNORED_EMAIL_LOCAL.has(local);
      }),
  );
}

function collectPhones(html: string): string[] {
  const phones: string[] = [];

  for (const match of html.matchAll(/href=["']tel:([^"']+)/gi)) {
    if (match[1]) phones.push(decodeHtml(match[1]));
  }

  for (const block of extractJsonLd(html)) {
    const nodes: Record<string, unknown>[] = [];
    flattenJsonLd(block, nodes);
    for (const node of nodes) {
      if (typeof node.telephone === "string" && node.telephone.trim()) {
        phones.push(node.telephone.trim());
      }
    }
  }

  const text = stripTags(html);

  for (const match of text.matchAll(TEL_LABEL_PHONE)) {
    if (match[1]) phones.push(match[1].trim());
  }

  for (const match of text.matchAll(INTL_PHONE_PATTERN)) {
    const idx = match.index ?? 0;
    const prefix = text.slice(Math.max(0, idx - 14), idx);
    if (/(?:tele)?fax\s*[:.]?\s*$/i.test(prefix)) continue;
    phones.push(match[0].trim());
  }

  for (const match of text.matchAll(PHONE_PATTERN)) {
    const idx = match.index ?? 0;
    const prefix = text.slice(Math.max(0, idx - 14), idx);
    if (/(?:tele)?fax\s*[:.]?\s*$/i.test(prefix)) continue;
    const digits = match[0].replace(/\D/g, "");
    if (digits.length >= 8 && digits.length <= 15) phones.push(match[0].trim());
  }

  return uniqueStrings(phones.map((phone) => normalizePhoneNumber(phone)).filter(Boolean));
}

function pickBestPhone(phones: string[]): string {
  const intl = phones.find((phone) => phone.trim().startsWith("+"));
  return intl ?? phones[0] ?? "";
}

function joinContactPhones(phones: string[]): string {
  const seenDigits = new Set<string>();
  const unique: string[] = [];
  for (const raw of phones) {
    const cleaned = raw.trim();
    const digits = cleaned.replace(/\D/g, "");
    if (!cleaned || digits.length < 7 || seenDigits.has(digits)) continue;
    seenDigits.add(digits);
    unique.push(cleaned);
  }
  if (unique.length === 0) return "";
  // Keep up to two distinct direct numbers (e.g. NO + FR).
  return unique.slice(0, 2).join(" · ");
}

function scoreCompanyEmail(email: string): number {
  const local = (email.split("@")[0] ?? "").toLowerCase();
  const index = COMPANY_EMAIL_PRIORITY.indexOf(local);
  return index === -1 ? 100 : index;
}

function pickCompanyEmail(emails: string[], domain: string, personalLocals: Set<string>): string {
  const bareDomain = domain.replace(/^www\./, "").toLowerCase();
  const siteBase = bareDomain.split(".")[0] ?? "";

  const exactDomainEmails = emails.filter((email) => {
    const emailDomain = (email.split("@")[1] ?? "").toLowerCase();
    return emailDomain === bareDomain || emailDomain.endsWith(`.${bareDomain}`);
  });
  const siblingDomainEmails =
    exactDomainEmails.length === 0 && siteBase.length >= 3
      ? emails.filter((email) =>
          (email.split("@")[1] ?? "").toLowerCase().startsWith(`${siteBase}.`),
        )
      : [];
  const pool =
    exactDomainEmails.length > 0
      ? exactDomainEmails
      : siblingDomainEmails.length > 0
        ? siblingDomainEmails
        : emails;

  const general = pool.filter((email) => {
    const local = (email.split("@")[0] ?? "").toLowerCase();
    if (COMPANY_EMAIL_PRIORITY_SET.has(local)) return true;
    return !personalLocals.has(local);
  });
  const priority = general.filter((email) =>
    COMPANY_EMAIL_PRIORITY_SET.has((email.split("@")[0] ?? "").toLowerCase()),
  );
  if (priority.length > 0) {
    return priority.sort((a, b) => scoreCompanyEmail(a) - scoreCompanyEmail(b))[0]!;
  }
  return general[0] ?? "";
}

function pickCompanyPhone(phones: string[]): string {
  return pickBestPhone(phones);
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

function scoreGeoCompleteness(geo: StructuredGeoAddress): number {
  let score = 0;
  if (geo.streetAddress) score += 4;
  if (geo.postalCode) score += 3;
  if (geo.city) score += 3;
  if (geo.stateRegion) score += 1;
  if (geo.country) score += 2;
  if (geo.countryCode) score += 1;
  return score;
}

function resolveDiscoveryGeo(
  htmlPages: string[],
  addressLines: string[],
  domain: string,
): StructuredGeoAddress {
  const fromJsonLd = extractJsonLdPostalAddresses(htmlPages, domain);
  const bestJsonLd = fromJsonLd.sort(
    (a, b) => scoreGeoCompleteness(b) - scoreGeoCompleteness(a),
  )[0];
  if (bestJsonLd && (bestJsonLd.streetAddress || (bestJsonLd.postalCode && bestJsonLd.city))) {
    return bestJsonLd;
  }

  let bestParsed: StructuredGeoAddress | null = null;
  let bestScore = 0;
  for (const line of addressLines) {
    const parsed = parseStructuredGeoAddress(line, domain);
    const score = scoreGeoCompleteness(parsed);
    if (score > bestScore && (parsed.streetAddress || (parsed.postalCode && parsed.city))) {
      bestParsed = parsed;
      bestScore = score;
    }
  }

  if (bestParsed && hasStructuredGeo(bestParsed)) {
    return bestParsed;
  }

  if (bestJsonLd && hasStructuredGeo(bestJsonLd)) {
    return bestJsonLd;
  }

  const fromDomain = enrichStructuredGeo({}, domain);
  return hasStructuredGeo(fromDomain) ? fromDomain : emptyStructuredGeo();
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

function looksLikeStreetLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 3 || trimmed.length > 85) return false;
  if (NON_STREET_LINE.test(trimmed)) return false;
  // Must contain letters AND a house number, and must not be purely a legal entity name without a number
  if (!/[A-Za-zÀ-ÿ]/.test(trimmed) || !/\d/.test(trimmed)) return false;
  // Reject postal-code lines (4-5 consecutive digits) unless they also have a preceding street + house number
  if (/^\s*(?:[A-Z]{1,2}-)?\d{4,6}\b/.test(trimmed)) return false;
  // Reject lines that look like phone numbers (too many digits)
  if (trimmed.replace(/\D/g, "").length > 6) return false;
  return (
    HOUSE_FIRST_STREET.test(trimmed) ||
    /^[A-ZÆØÅÄÖÜÀ-Ÿ][A-Za-zæøåäöüà-ÿß.'’\s-]{1,60}\s+\d{1,4}[A-Za-z]?(?:\s*[-/]\s*\d{1,4}[A-Za-z]?)?$/.test(
      trimmed,
    )
  );
}

function extractPostalCityMatch(line: string): {
  index: number;
  postalCode: string;
  city: string;
  matchedText: string;
} | null {
  if (NON_STREET_LINE.test(line)) return null;
  const match = line.match(POSTAL_CITY_LINE);
  if (!match?.[1] || !match[2] || typeof match.index !== "number") return null;

  const postalCode = match[1].trim();
  const rawCity = match[2].trim();
  const firstWord = rawCity.split(/\s+/)[0] ?? "";
  if (firstWord.length < 2 || NON_CITY_WORD.test(firstWord)) return null;

  // Reject dates or years like "2026 - 2027" or "1998 Gründung"
  if (/^(19|20)\d{2}$/.test(postalCode) && match.index === 0 && rawCity.split(/\s+/).length > 2) {
    return null;
  }

  return {
    index: match.index,
    postalCode,
    city: rawCity,
    matchedText: match[0].trim(),
  };
}

function extractAddressCandidatesFromLines(lines: string[]): string[] {
  const found: string[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    if (line.length > 140) continue;

    const postal = extractPostalCityMatch(line);
    if (!postal) continue;

    const beforePostal = line.slice(0, postal.index).replace(/[,;\s-]+$/, "").trim();
    const nextLine = lines[i + 1] ?? "";
    const country = nextLine.length <= 40 && resolveCountry(nextLine) ? nextLine : "";

    if (beforePostal && looksLikeStreetLine(beforePostal)) {
      found.push([beforePostal, postal.matchedText, country].filter(Boolean).join(", "));
      continue;
    }

    const prevLine = lines[i - 1] ?? "";
    if (prevLine && looksLikeStreetLine(prevLine)) {
      found.push([prevLine, postal.matchedText, country].filter(Boolean).join(", "));
      continue;
    }

    // Standalone postal + city (lower signal, still useful if street isn't adjacent)
    if (postal.index === 0 && line.length <= 60) {
      found.push([postal.matchedText, country].filter(Boolean).join(", "));
    }
  }

  return uniqueStrings(found);
}

function extractAddressLines(html: string): string[] {
  const addresses: string[] = [];

  // 1. Explicit HTML5 <address> elements
  for (const match of html.matchAll(/<address[^>]*>([\s\S]{10,600}?)<\/address>/gi)) {
    const lines = htmlToLines(match[1] ?? "");
    addresses.push(...extractAddressCandidatesFromLines(lines));
  }

  // 2. Line-preserved scan of <main>, <article>, and <footer> blocks (preserves <br> & <p> breaks!)
  const prioritizedRegions = [
    ...(html.match(/<main[\s\S]*?<\/main>/gi) ?? []),
    ...(html.match(/<footer[\s\S]*?<\/footer>/gi) ?? []),
  ];
  for (const region of prioritizedRegions) {
    addresses.push(...extractAddressCandidatesFromLines(htmlToLines(region)));
  }

  // 3. Full document line scan fallback
  addresses.push(...extractAddressCandidatesFromLines(htmlToLines(html)));

  // 4. Elementor icon-list items
  for (const match of html.matchAll(/elementor-icon-list-text[^>]*>([^<]+)</gi)) {
    const value = stripTags(match[1] ?? "").replace(/\s+/g, " ").trim();
    if (value.length > 90) continue;
    if (/,\s*\d{4,5}\s+[A-ZÆØÅÄÖÜÀ-Ÿ]/.test(value) || /^\d{4,5}\s+[A-ZÆØÅÄÖÜÀ-Ÿ]/.test(value)) {
      addresses.push(value);
    }
  }

  // 5. Multi-paragraph address blocks:
  // <p>5 Industrivegen</p><p>6600 Sunndalsøra,</p><p>Norway</p>
  const paragraphRuns = [
    ...html.matchAll(
      /<p[^>]*>\s*([^<]{3,80})\s*<\/p>\s*<p[^>]*>\s*([^<]{3,80})\s*<\/p>\s*<p[^>]*>\s*([^<]{3,40})\s*<\/p>/gi,
    ),
  ];
  for (const match of paragraphRuns) {
    const a = stripTags(match[1] ?? "").replace(/\s+/g, " ").trim();
    const b = stripTags(match[2] ?? "").replace(/\s+/g, " ").trim();
    const c = stripTags(match[3] ?? "").replace(/\s+/g, " ").trim();
    const joined = `${a}, ${b.replace(/,$/, "")}, ${c}`;
    if (
      looksLikeStreetLine(a) &&
      Boolean(extractPostalCityMatch(b)) &&
      Boolean(resolveCountry(c))
    ) {
      addresses.push(joined);
    }
  }

  // Two-paragraph: street + "6600 City" / "37696 City"
  const twoParagraphRuns = [
    ...html.matchAll(/<p[^>]*>\s*([^<]{3,80})\s*<\/p>\s*<p[^>]*>\s*([^<]{3,80})\s*<\/p>/gi),
  ];
  for (const match of twoParagraphRuns) {
    const a = stripTags(match[1] ?? "").replace(/\s+/g, " ").trim();
    const b = stripTags(match[2] ?? "").replace(/\s+/g, " ").trim().replace(/,$/, "");
    if (looksLikeStreetLine(a) && Boolean(extractPostalCityMatch(b))) {
      addresses.push(`${a}, ${b}`);
    }
  }

  const text = stripTags(html);
  for (const match of text.matchAll(STREET_LINE)) {
    const line = `${match[1]?.trim()}, ${match[2]} ${match[3]?.trim()}`;
    if (line.length <= 90) addresses.push(line);
  }

  // House-number-first + postal/city elsewhere on same text blob
  for (const match of text.matchAll(
    new RegExp(
      `${HOUSE_FIRST_STREET.source}[,\\s]+${NORWEGIAN_POSTAL_LINE.source}(?:,\\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\\s-]+))?`,
      "gi",
    ),
  )) {
    const street = `${match[1]} ${match[2]}`.trim();
    const postalCity = `${match[3]} ${match[4]}`.trim();
    const country = match[5]?.trim() ?? "";
    addresses.push([street, postalCity, country].filter(Boolean).join(", "));
  }

  return uniqueStrings(addresses);
}

const EU_VAT_VALUE_PATTERN =
  /\b(DE\s*\d{9}|AT\s*U\d{8}|CH[E]?-?\d{3}\.?\d{3}\.?\d{3}(?:\s*MWST)?|NO\s*\d{3}\s*\d{3}\s*\d{3}\s*MVA|SE\s*\d{12}|DK\s*\d{8}|FI\s*\d{8}|FR\s*[A-Z0-9]{2}\s*\d{9}|NL\s*\d{9}B\d{2}|BE\s*0?\d{9,10}|GB\s*\d{9}(?:\d{3})?|ES\s*[A-Z0-9]\d{7}[A-Z0-9]|IT\s*\d{11}|PL\s*\d{10}|PT\s*\d{9}|IE\s*\d[A-Z0-9+*]\d{5}[A-Z]{1,2})\b/i;

const VAT_LABEL_PATTERN =
  /\b(?:umsatzsteuer-?id(?:entifikationsnummer)?|ust\.?-?id\.?(?:-?nr\.?)?|uid-?nr\.?|mwst-?nr\.?|vat(?:\s*(?:no\.?|number|id|reg\.?))?|tva(?:\s+intracommunautaire)?|btw(?:-?(?:nr\.?|nummer))?|mva)\b/i;

const REG_COURT_PATTERN = /\b(?:registergericht|amtsgericht)\s*:?\s*([A-ZÆØÅÄÖÜÀ-Ÿ][A-Za-zæøåäöüà-ÿß\s-]{2,50})/i;

function normalizeVatNumber(raw: string): string {
  const upper = raw.trim().toUpperCase();
  if (/^NO\s/.test(upper) || /MVA$/.test(upper) || /^CHE/.test(upper)) {
    return upper.replace(/\s+/g, " ");
  }
  return upper.replace(/\s+/g, "");
}

function extractCompanyLegalDetails(pages: { url: string; html: string }[]): {
  registrationNumber?: string;
  vatNumber?: string;
  industryCode?: string;
  industryDescription?: string;
} {
  let registrationNumber = "";
  let registerCourt = "";
  let vatNumber = "";
  let industryCode = "";
  let industryDescription = "";

  // Prioritize legal/imprint pages first for registration & VAT details
  const orderedPages = [...pages].sort((a, b) => {
    const aLegal = /impressum|imprint|legal|rechtliches|mentions-l/i.test(a.url) ? 0 : 1;
    const bLegal = /impressum|imprint|legal|rechtliches|mentions-l/i.test(b.url) ? 0 : 1;
    return aLegal - bLegal;
  });

  for (const page of orderedPages) {
    // JSON-LD Organization metadata (industry / naics / concise description)
    for (const block of extractJsonLd(page.html)) {
      const nodes: Record<string, unknown>[] = [];
      flattenJsonLd(block, nodes);
      for (const node of nodes) {
        const type = Array.isArray(node["@type"]) ? node["@type"].join(" ") : String(node["@type"] ?? "");
        if (!/Organization|Corporation|LocalBusiness/i.test(type)) continue;

        if (!vatNumber && typeof node.vatID === "string" && node.vatID.trim()) {
          vatNumber = normalizeVatNumber(node.vatID);
        }
        if (!industryCode && typeof node.naics === "string" && node.naics.trim()) {
          industryCode = node.naics.trim();
        }
        if (!industryCode && typeof node.isicV4 === "string" && node.isicV4.trim()) {
          industryCode = node.isicV4.trim();
        }
        if (!industryDescription && typeof node.industry === "string" && node.industry.trim()) {
          industryDescription = decodeHtml(node.industry.trim());
        }
        if (!industryDescription && typeof node.description === "string") {
          const desc = decodeHtml(node.description).replace(/\s+/g, " ").trim();
          if (desc.length >= 6 && desc.length <= 100 && !/cookie|datenschutz|privacy/i.test(desc)) {
            industryDescription = desc;
          }
        }
      }
    }

    const lines = htmlToLines(page.html);
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i]!;
      const nextLine = lines[i + 1] ?? "";

      // VAT number: same line or next line after a VAT/Umsatzsteuer-ID heading
      if (!vatNumber && VAT_LABEL_PATTERN.test(line)) {
        const inlineMatch = line.match(EU_VAT_VALUE_PATTERN);
        if (inlineMatch?.[1]) {
          vatNumber = normalizeVatNumber(inlineMatch[1]);
        } else if (nextLine) {
          const nextMatch = nextLine.match(EU_VAT_VALUE_PATTERN);
          if (nextMatch?.[1]) {
            vatNumber = normalizeVatNumber(nextMatch[1]);
          }
        }
      }

      // Register court (German Registergericht)
      if (!registerCourt) {
        const courtMatch = line.match(REG_COURT_PATTERN);
        if (courtMatch?.[1]) {
          registerCourt = courtMatch[1].trim();
        }
      }

      // Registration number (German Handelsregister / HRB / HRA, Nordic Org.nr / CVR / Y-tunnus, UK/NL/FR)
      if (!registrationNumber) {
        const deReg =
          line.match(/\b(?:Handelsregister(?:nummer|-?Nr\.?)?|Registernummer|Register-?Nr\.?)\s*:\s*((?:HR[AB]\s*)?[A-Z0-9][A-Z0-9\s/-]{2,20})/i) ??
          line.match(/\b(HR[AB]\s*\d{2,8}(?:\s*[A-Z])?)\b/) ??
          line.match(/\bFirmenbuch(?:nummer|-?Nr\.?)?\s*:?\s*(FN\s*\d+[a-z]?)\b/i);
        if (deReg?.[1]) {
          const candidate = deReg[1].trim();
          if (/\d{3,}/.test(candidate)) {
            registrationNumber = candidate;
          }
        }

        const nordicOrEuReg =
          line.match(/\b(?:Org\.?\s*nr\.?|Organisasjonsnummer|Organisationsnummer)\s*:?\s*((?:NO\s*)?\d{3}\s?\d{3}\s?\d{3}|\d{6}-\d{4})\b/i) ??
          line.match(/\bCVR(?:-?nr\.?)?\s*:?\s*(\d{8})\b/i) ??
          line.match(/\bY-tunnus\s*:?\s*(\d{7}-\d)\b/i) ??
          line.match(/\bKvK(?:-?(?:nr\.?|nummer))?\s*:?\s*(\d{8})\b/i) ??
          line.match(/\bSIRET\s*:?\s*(\d{3}\s?\d{3}\s?\d{3}\s?\d{5})\b/i) ??
          line.match(/\bSIREN\s*:?\s*(\d{3}\s?\d{3}\s?\d{3})\b/i) ??
          line.match(/\bCompany\s+(?:Registration\s+)?(?:No\.?|Number)\s*:?\s*([A-Z0-9]{6,12})\b/i);
        if (!registrationNumber && nordicOrEuReg?.[1]) {
          registrationNumber = nordicOrEuReg[1].trim();
        }
      }
    }
  }

  // If German Handelsregister is a bare number (e.g. "7128") and Registergericht was found, include court for clarity.
  if (
    registrationNumber &&
    /^\d{2,8}$/.test(registrationNumber) &&
    registerCourt
  ) {
    registrationNumber = `${registrationNumber} (${registerCourt})`;
  }

  return {
    registrationNumber: registrationNumber || undefined,
    vatNumber: vatNumber || undefined,
    industryCode: industryCode || undefined,
    industryDescription: industryDescription || undefined,
  };
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
        registrationNumber: discovery.company.registrationNumber?.trim() || undefined,
        vatNumber: discovery.company.vatNumber?.trim() || undefined,
        industryCode: discovery.company.industryCode?.trim() || undefined,
        industryDescription: discovery.company.industryDescription?.trim() || undefined,
      },
      geo,
    ),
  };
}

const NON_PERSON_NAME_PATTERN =
  /\b(contact|kontakt|about|om\s+oss|team|home|menu|read\s+more|les\s+mer|follow\s+us|legal|imprint|impressum|privacy|datenschutz|data\s+protection|accessibility|cookie|cookies|social\s+media|soziale\s+medien|company|unternehmen|holidays|betriebsferien|opening\s+hours|öffnungszeiten|google\s+maps|more\s+information|amtsgericht|registergericht|handelsregister|zertifizierung|creditreform|verwaltung|dokumentation|maschinenbau|hydraulik|automatisierung|steuerung|service|services|leistungen|informationen|karriere|career|referenzen|references|anfahrt|zentrale|werkstatt|ihr\s+weg|wir\s+sind|unser\s+|unsere\s+|gmbh|ltd|inc|llc|sarl|sas|ag|kg|ohg)\b/i;

function looksLikePersonName(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length < 4 || trimmed.length > 80) return false;
  if (!/[A-ZÆØÅÁÉÍÓÚÄÖÜ]/.test(trimmed)) return false;
  if (/@|https?:|www\./i.test(trimmed)) return false;
  if (LANGUAGE_LINE.test(trimmed)) return false;
  if (NON_PERSON_NAME_PATTERN.test(trimmed)) return false;
  if (NORDIC_JOB_TITLE_HINT.test(trimmed) && !/\s/.test(trimmed)) return false;
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length < 2 || parts.length > 4) return false;
  return parts.every((part) => /^[A-ZÆØÅÁÉÍÓÚÄÖÜ][A-Za-zæøåäöüà-ÿß'’-]+$/u.test(part));
}

function extractNearbyContactDetails(blockHtml: string, personName: string): {
  email: string;
  phone: string;
  phones: string[];
} {
  const emails = collectEmails(blockHtml);
  const phones = collectPhones(blockHtml);
  const first = personName.split(/\s+/)[0]?.toLowerCase() ?? "";
  const email =
    emails.find((value) => {
      const local = (value.split("@")[0] ?? "").toLowerCase();
      return first.length > 2 && local.includes(first);
    }) ??
    emails.find((value) => !COMPANY_EMAIL_PRIORITY.includes((value.split("@")[0] ?? "").toLowerCase())) ??
    emails[0] ??
    "";

  return {
    email,
    phone: joinContactPhones(phones) || pickBestPhone(phones),
    phones,
  };
}

function extractImageBoxContacts(html: string): DiscoveredContact[] {
  const contacts: DiscoveredContact[] = [];
  const pattern =
    /elementor-image-box-title[^>]*>([^<]+)<\/h[1-6]>[\s\S]{0,500}?elementor-image-box-description[^>]*>([^<]+)<\/p>/gi;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const name = stripTags(match[1] ?? "");
    const jobTitle = stripTags(match[2] ?? "");
    if (!looksLikePersonName(name)) continue;

    // Include following sibling widgets (phone / email often live just after the image box).
    const tail = html.slice(match.index, match.index + 1_800);
    const details = extractNearbyContactDetails(tail, name);

    contacts.push({
      id: `contact-${contacts.length + 1}`,
      name,
      jobTitle,
      email: details.email,
      phone: details.phone,
    });
  }

  return contacts;
}

/**
 * Structured team / contact-person cards (WordPress person blocks, team-member cards, etc.).
 * Keeps each card strictly isolated so phones and emails never bleed between contacts.
 */
function extractStructuredPersonCards(html: string): DiscoveredContact[] {
  const contacts: DiscoveredContact[] = [];
  const cardPatterns = [
    /<article[^>]+class=["'][^"']*\b(?:person|team-member|team_member|staff-member|employee|contact-person|ansprechpartner)\b[^"']*["'][^>]*>([\s\S]{30,3500}?)<\/article>/gi,
    /<div[^>]+class=["'][^"']*\b(?:person__inner|team-member|team_member|staff-member|contact-person|ansprechpartner)\b[^"']*["'][^>]*>([\s\S]{30,2500}?)<\/div>/gi,
  ];

  for (const cardPattern of cardPatterns) {
    let match: RegExpExecArray | null;
    while ((match = cardPattern.exec(html)) !== null) {
      const cardHtml = match[1] ?? "";
      const nameMatch =
        cardHtml.match(/class=["'][^"']*(?:person__title|member-name|team-name|contact-name)[^"']*["'][^>]*>([\s\S]*?)<\/(?:h[1-6]|div|span|p|strong)>/i) ??
        cardHtml.match(/<h[2-6][^>]*>([\s\S]{3,120}?)<\/h[2-6]>/i) ??
        cardHtml.match(/<strong[^>]*>([\s\S]{3,120}?)<\/strong>/i);

      const name = stripTags(nameMatch?.[1] ?? "").replace(/\s+/g, " ").trim();
      if (!looksLikePersonName(name)) continue;

      const positionMatch = cardHtml.match(
        /class=["'][^"']*(?:person__position|position|role|job-title|member-role|team-role)[^"']*["'][^>]*>([\s\S]*?)<\/(?:span|p|div)>/i,
      );
      let jobTitle = stripTags(positionMatch?.[1] ?? "").replace(/\s+/g, " ").trim();
      if (!jobTitle) {
        const cardLines = htmlToLines(cardHtml);
        const nameIdx = cardLines.findIndex((line) => line === name);
        const candidate = nameIdx >= 0 ? cardLines[nameIdx + 1] ?? "" : "";
        if (
          candidate &&
          candidate.length <= 100 &&
          !candidate.includes("@") &&
          !/\+?\d[\d\s()./\u2013\u2014-]{6,}/.test(candidate)
        ) {
          jobTitle = candidate;
        }
      }

      const details = extractNearbyContactDetails(cardHtml, name);
      if (!details.email && !details.phone && !jobTitle) continue;

      contacts.push({
        id: `card-${contacts.length + 1}`,
        name,
        jobTitle: LANGUAGE_LINE.test(jobTitle) ? "" : jobTitle,
        email: details.email,
        phone: details.phone,
      });
    }
  }

  return contacts;
}

/**
 * Explicit role-labeled contacts commonly found in legal / imprint pages.
 * Example: "Geschäftsführung: Thomas Scherer" or "Managing Director: Jane Doe"
 */
function extractRoleLabeledContacts(html: string): DiscoveredContact[] {
  const contacts: DiscoveredContact[] = [];
  const lines = htmlToLines(html);
  const roleLabelPattern =
    /^(Geschäftsführung|Geschäftsführer(?:in)?|Vorstand|Inhaber(?:in)?|Managing\s+Director|Chief\s+Executive\s+Officer|CEO|Daglig\s+leder|Directeur\s+Général|Gérant)\s*:\s*(.+)$/i;

  for (const line of lines) {
    const match = line.match(roleLabelPattern);
    if (!match?.[1] || !match[2]) continue;
    const role = match[1].trim();
    const rawNames = match[2]
      .split(/,|;|\bund\b|\band\b|&/i)
      .map((part) => part.trim())
      .filter(Boolean);

    for (const candidate of rawNames) {
      if (!looksLikePersonName(candidate)) continue;
      contacts.push({
        id: `role-${contacts.length + 1}`,
        name: candidate,
        jobTitle: role,
        email: "",
        phone: "",
      });
    }
  }

  return contacts;
}

/**
 * Nordic / Elementor team cards: heading name followed by job title + Tel./email paragraphs.
 * Example: Halvor Kittelsen / Daglig Leder / Tel. +47 … / email
 */
function extractHeadingTeamContacts(html: string): DiscoveredContact[] {
  const contacts: DiscoveredContact[] = [];
  const headingPattern =
    /<(h[2-6]|p)[^>]*>([^<]{4,80})<\/\1>[\s\S]{0,120}?(?:<(?:p|div|span)[^>]*>\s*)?([^<]{3,80})/gi;

  let match: RegExpExecArray | null;
  while ((match = headingPattern.exec(html)) !== null) {
    const name = stripTags(match[2] ?? "").replace(/\s+/g, " ").trim();
    const maybeTitle = stripTags(match[3] ?? "").replace(/\s+/g, " ").trim();
    if (!looksLikePersonName(name)) continue;

    const hasTitleHint = NORDIC_JOB_TITLE_HINT.test(maybeTitle);
    const jobTitle = hasTitleHint || maybeTitle.length <= 60 ? maybeTitle : "";

    // Bound lookahead at the next card/article/section/heading so adjacent contacts never bleed together.
    const rawSlice = html.slice(match.index, match.index + 1_800);
    const afterHeading = rawSlice.slice(match[0].length);
    const boundaryMatch = afterHeading.match(/<\/(?:article|section)>|<h[1-6]\b/i);
    const block =
      boundaryMatch && typeof boundaryMatch.index === "number"
        ? rawSlice.slice(0, match[0].length + boundaryMatch.index)
        : rawSlice;

    const details = extractNearbyContactDetails(block, name);
    // Require concrete contact evidence (email, phone, or explicit job title keyword) to avoid heading false positives.
    if (!details.email && !details.phone && !hasTitleHint) continue;

    contacts.push({
      id: `heading-${contacts.length + 1}`,
      name,
      jobTitle: LANGUAGE_LINE.test(jobTitle) ? "" : jobTitle,
      email: details.email,
      phone: details.phone,
    });
  }

  return contacts;
}

/** Parse consecutive <p> blocks that look like team member cards. */
function extractParagraphTeamContacts(html: string): DiscoveredContact[] {
  const contacts: DiscoveredContact[] = [];
  const blocks = html.match(/<(?:div|article|li|section)[^>]{0,200}>[\s\S]{40,1200}?<\/(?:div|article|li|section)>/gi) ?? [];

  for (const block of blocks) {
    const text = stripTags(block);
    const lines = text
      .split(/\n+/)
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean);

    // Flatten HTML paragraphs into lines when stripTags collapsed them.
    const paragraphLines =
      [...block.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
        .map((entry) => stripTags(entry[1] ?? "").replace(/\s+/g, " ").trim())
        .filter(Boolean) ?? [];

    const candidates = paragraphLines.length >= 2 ? paragraphLines : lines;
    if (candidates.length < 2) continue;

    const nameIdx = candidates.findIndex((line) => looksLikePersonName(line));
    if (nameIdx < 0) continue;

    const name = candidates[nameIdx]!;
    const after = candidates.slice(nameIdx + 1, nameIdx + 6);
    const jobTitle =
      after.find((line) => NORDIC_JOB_TITLE_HINT.test(line) && !line.includes("@") && !/\d{5,}/.test(line)) ??
      "";

    const details = extractNearbyContactDetails(block, name);
    if (!details.email && !details.phone) continue;

    contacts.push({
      id: `block-${contacts.length + 1}`,
      name,
      jobTitle: LANGUAGE_LINE.test(jobTitle) ? "" : jobTitle,
      email: details.email,
      phone: details.phone,
    });
  }

  return contacts;
}

function extractEmailNamedContacts(html: string, domain: string): DiscoveredContact[] {
  const contacts: DiscoveredContact[] = [];
  const bareDomain = domain.replace(/^www\./, "");

  for (const email of collectEmails(html)) {
    if (!email.endsWith(`@${domain}`) && !email.endsWith(`@${bareDomain}`)) {
      // Also accept sibling TLDs like fjordfilter.no when site is fjordfilter.com
      const emailDomain = email.split("@")[1] ?? "";
      const siteBase = bareDomain.split(".")[0] ?? "";
      if (!emailDomain.startsWith(`${siteBase}.`)) continue;
    }

    const local = email.split("@")[0] ?? "";
    if (COMPANY_EMAIL_PRIORITY.includes(local)) continue;
    if (/^(info|kontakt|contact|post|hello|office|sales|support)$/i.test(local)) continue;

    const nameParts = local
      .split(/[._-]/)
      .filter((part) => part.length > 1)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase());

    if (nameParts.length < 2) continue;

    const name = nameParts.join(" ");
    if (!looksLikePersonName(name)) continue;
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

  // Prioritize imprint & contact pages first for address extraction
  const addressOrderedPages = [...pages].sort((a, b) => {
    const score = (url: string) => {
      if (/impressum|imprint|legal|rechtliches/i.test(url)) return 0;
      if (/kontakt|contact/i.test(url)) return 1;
      return 2;
    };
    return score(a.url) - score(b.url);
  });

  const emails = collectEmails(combinedHtml);
  const phones = collectPhones(combinedHtml);
  const addresses = uniqueStrings(
    addressOrderedPages.flatMap((page) => extractAddressLines(page.html)),
  );
  const companyName = inferCompanyName(htmlPages, domain);
  const geo = resolveDiscoveryGeo(htmlPages, addresses, domain);
  const legal = extractCompanyLegalDetails(pages);

  const structuredCardContacts = htmlPages.flatMap((html) => extractStructuredPersonCards(html));
  const imageBoxContacts = htmlPages.flatMap((html) => extractImageBoxContacts(html));
  const headingContacts = htmlPages.flatMap((html) => extractHeadingTeamContacts(html));
  const paragraphContacts = htmlPages.flatMap((html) => extractParagraphTeamContacts(html));
  const roleLabeledContacts = htmlPages.flatMap((html) => extractRoleLabeledContacts(html));

  const teamContacts = mergeContacts(
    mergeContacts(
      mergeContacts(
        mergeContacts(structuredCardContacts, imageBoxContacts),
        headingContacts,
      ),
      paragraphContacts,
    ),
    roleLabeledContacts,
  );
  const personalLocals = new Set(
    teamContacts
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
      address: formatStructuredGeoLine(geo) || addresses[0] || "",
      domain,
      registrationNumber: legal.registrationNumber,
      vatNumber: legal.vatNumber,
      industryCode: legal.industryCode,
      industryDescription: legal.industryDescription,
    },
    geo,
  );

  const contacts = dedupeContacts(
    mergeContacts(teamContacts, extractEmailNamedContacts(combinedHtml, domain)),
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

  // Best-effort OSM geo enrichment when street/postal+city were found but state/region or country is still missing.
  const hasAddressSignal = Boolean(
    result.company.streetAddress || (result.company.postalCode && result.company.city),
  );
  if (hasAddressSignal && (!result.company.stateRegion || !result.company.country)) {
    const query = [
      result.company.streetAddress,
      [result.company.postalCode, result.company.city].filter(Boolean).join(" "),
      result.company.country,
    ]
      .filter(Boolean)
      .join(", ");
    if (query) {
      try {
        const osm = await lookupAddressOSM(query, { timeoutMs: 2_500 });
        if (!result.company.stateRegion && osm.stateRegion) {
          result.company.stateRegion = osm.stateRegion;
        }
        if (!result.company.country && osm.country) {
          const enriched = enrichStructuredGeo(
            {
              streetAddress: result.company.streetAddress,
              postalCode: result.company.postalCode,
              city: result.company.city,
              stateRegion: result.company.stateRegion,
              country: osm.country,
              countryCode: result.company.countryCode || osm.countryCode,
              continent: result.company.continent || osm.continent,
            },
            result.company.domain,
          );
          result.company.country = enriched.country;
          result.company.countryCode = enriched.countryCode;
          result.company.continent = enriched.continent;
        }
      } catch {
        // Best-effort only — discovery succeeds even if Nominatim is slow or unavailable.
      }
    }
  }

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
