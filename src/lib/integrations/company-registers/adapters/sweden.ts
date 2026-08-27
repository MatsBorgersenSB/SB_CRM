import { euViesAdapter, parseEuVatNumber } from "@/lib/integrations/company-registers/adapters/eu-vies";
import {
  cleanText,
  emptyCompany,
  fetchRegistryText,
} from "@/lib/integrations/company-registers/http";
import type {
  RegistryAdapter,
  UnifiedEuropeanCompany,
} from "@/lib/integrations/company-registers/types";

/**
 * Sweden has no public name-search REST API at Bolagsverket (lookup is by
 * organisationsnummer only, and that API needs a customer registration).
 *
 * Identifier search uses EU VIES (SE + 10-digit orgnr + 01).
 * Name search uses Letabolag's public index (Bolagsverket / SCB sourced),
 * then confirms the hit against VIES when the VAT number is valid.
 */

const ITEM_RE =
  /<a href="\/foretag\/[^"]+" class="name">([^<]+)<\/a>\s*<div>\s*<span class="orgnr">(\d{6}-\d{4})<\/span>(?:\s*<span class="city">\s*(?:·|&middot;|&bull;)\s*([^<]+)<\/span>)?(?:\s*<span class="sni">\s*(?:·|&middot;|&bull;)\s*([^<]+)<\/span>)?/gi;

function decodeHtml(value: string): string {
  return cleanText(
    value
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&middot;/g, "·")
      .replace(/&bull;/g, "·")
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code))),
  );
}

function compactDigits(value: string): string {
  return value.replace(/[\s.\-]/g, "");
}

function luhnOk(digits: string): boolean {
  let sum = 0;
  let doubleIt = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let n = Number(digits[i]);
    if (Number.isNaN(n)) return false;
    if (doubleIt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    doubleIt = !doubleIt;
  }
  return sum % 10 === 0;
}

/** Swedish organisationsnummer: 10 digits, company "month" 20–99, Luhn checksum. */
export function parseSwedishOrgnr(query: string): string | null {
  const digits = compactDigits(query);
  if (!/^\d{10}$/.test(digits)) return null;
  const month = Number(digits.slice(2, 4));
  if (month < 20) return null;
  if (!luhnOk(digits)) return null;
  return digits;
}

export function formatSwedishOrgnr(digits: string): string {
  const compact = compactDigits(digits);
  if (compact.length !== 10) return digits;
  return `${compact.slice(0, 6)}-${compact.slice(6)}`;
}

function swedishVatFromOrgnr(orgnr: string): string {
  return `SE${orgnr}01`;
}

async function lookupByOrgnr(orgnr: string): Promise<UnifiedEuropeanCompany | null> {
  const viesHits = await euViesAdapter.search(swedishVatFromOrgnr(orgnr));
  const vies = viesHits[0];
  if (!vies) return null;
  return emptyCompany({
    ...vies,
    legalName: vies.legalName,
    registrationNumber: formatSwedishOrgnr(orgnr),
    vatNumber: swedishVatFromOrgnr(orgnr),
    country: "Sweden",
    countryCode: "SE",
    sourceRegistry: "EU VIES VAT (SE)",
  });
}

type NameHit = {
  legalName: string;
  orgnr: string;
  city?: string;
  industry?: string;
};

function parseLetabolag(html: string): NameHit[] {
  const hits: NameHit[] = [];
  ITEM_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ITEM_RE.exec(html))) {
    const legalName = decodeHtml(match[1] ?? "");
    const orgnr = compactDigits(match[2] ?? "");
    if (!legalName || !parseSwedishOrgnr(orgnr)) continue;
    hits.push({
      legalName,
      orgnr,
      city: decodeHtml(match[3] ?? "") || undefined,
      industry: decodeHtml(match[4] ?? "") || undefined,
    });
  }
  return hits;
}

function nameScore(name: string, query: string): number {
  const n = name.toLowerCase().replace(/[^a-z0-9åäö]/gi, "");
  const distinctive = query
    .toLowerCase()
    .replace(/\b(ab|hb|kb|as|asa|oy|a\/s)\b/gi, " ")
    .replace(/[^a-z0-9åäö]/gi, "");
  if (!distinctive || distinctive.length < 3) return 9;
  if (n === distinctive || n === `${distinctive}ab`) return 0;
  if (n.startsWith(distinctive)) return 1;
  if (n.includes(distinctive)) return 2;
  return 9;
}

async function searchByName(query: string): Promise<UnifiedEuropeanCompany[]> {
  const html = await fetchRegistryText(
    `https://letabolag.se/sok?q=${encodeURIComponent(query)}`,
  );
  if (!html) return [];

  const ranked = parseLetabolag(html)
    .map((hit) => ({ hit, score: nameScore(hit.legalName, query) }))
    .filter((row) => row.score < 9)
    .sort((a, b) => a.score - b.score || a.hit.legalName.localeCompare(b.hit.legalName))
    .slice(0, 8)
    .map((row) => row.hit);

  const confirmed = await Promise.all(
    ranked.slice(0, 5).map(async (hit) => {
      const vies = await lookupByOrgnr(hit.orgnr);
      if (vies) {
        return {
          ...vies,
          industryDescription: hit.industry ?? vies.industryDescription,
          city: vies.city || hit.city,
        };
      }
      return emptyCompany({
        legalName: hit.legalName,
        registrationNumber: formatSwedishOrgnr(hit.orgnr),
        vatNumber: swedishVatFromOrgnr(hit.orgnr),
        country: "Sweden",
        countryCode: "SE",
        city: hit.city,
        industryDescription: hit.industry,
        sourceRegistry: "Letabolag index (Bolagsverket / SCB)",
      });
    }),
  );

  const rest = ranked.slice(5).map((hit) =>
    emptyCompany({
      legalName: hit.legalName,
      registrationNumber: formatSwedishOrgnr(hit.orgnr),
      vatNumber: swedishVatFromOrgnr(hit.orgnr),
      country: "Sweden",
      countryCode: "SE",
      city: hit.city,
      industryDescription: hit.industry,
      sourceRegistry: "Letabolag index (Bolagsverket / SCB)",
    }),
  );

  return [...confirmed, ...rest];
}

export const swedenAdapter: RegistryAdapter = {
  id: "SE",
  countryCode: "SE",
  sourceRegistry: "Bolagsverket / SCB (SE)",
  async search(query: string): Promise<UnifiedEuropeanCompany[]> {
    const q = query.trim();
    if (!q) return [];

    const orgnr = parseSwedishOrgnr(q);
    if (orgnr) {
      const hit = await lookupByOrgnr(orgnr);
      return hit ? [hit] : [];
    }

    const vat = parseEuVatNumber(q);
    if (vat?.countryCode === "SE") {
      const orgnrFromVat = vat.vatNumber.length === 12 ? vat.vatNumber.slice(0, 10) : vat.vatNumber;
      if (parseSwedishOrgnr(orgnrFromVat)) {
        const hit = await lookupByOrgnr(orgnrFromVat);
        if (hit) return [hit];
      }
      return euViesAdapter.search(q);
    }

    return searchByName(q);
  },
};
