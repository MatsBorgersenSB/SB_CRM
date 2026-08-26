import { austriaAdapter } from "@/lib/integrations/company-registers/adapters/austria";
import { belgiumAdapter } from "@/lib/integrations/company-registers/adapters/belgium";
import { denmarkAdapter } from "@/lib/integrations/company-registers/adapters/denmark";
import { estoniaAdapter } from "@/lib/integrations/company-registers/adapters/estonia";
import { euViesAdapter, parseEuVatNumber } from "@/lib/integrations/company-registers/adapters/eu-vies";
import { finlandAdapter } from "@/lib/integrations/company-registers/adapters/finland";
import { franceAdapter } from "@/lib/integrations/company-registers/adapters/france";
import { germanyAdapter } from "@/lib/integrations/company-registers/adapters/germany";
import { italyAdapter } from "@/lib/integrations/company-registers/adapters/italy";
import { luxembourgAdapter } from "@/lib/integrations/company-registers/adapters/luxembourg";
import { netherlandsAdapter } from "@/lib/integrations/company-registers/adapters/netherlands";
import { norwayAdapter } from "@/lib/integrations/company-registers/adapters/norway";
import { portugalAdapter } from "@/lib/integrations/company-registers/adapters/portugal";
import { spainAdapter } from "@/lib/integrations/company-registers/adapters/spain";
import { swedenAdapter, parseSwedishOrgnr } from "@/lib/integrations/company-registers/adapters/sweden";
import { parseSwissUid, switzerlandAdapter } from "@/lib/integrations/company-registers/adapters/switzerland";
import { ukAdapter } from "@/lib/integrations/company-registers/adapters/uk";
import {
  foldRegistryName,
  LEGAL_FORM_SUFFIX_RE,
} from "@/lib/integrations/company-registers/legal-form";
import type {
  EuropeanRegistrySearchOptions,
  RegistryAdapter,
  UnifiedEuropeanCompany,
} from "@/lib/integrations/company-registers/types";

export type { UnifiedEuropeanCompany, EuropeanRegistrySearchOptions } from "@/lib/integrations/company-registers/types";

const ADAPTERS: RegistryAdapter[] = [
  norwayAdapter,
  swedenAdapter,
  denmarkAdapter,
  finlandAdapter,
  franceAdapter,
  ukAdapter,
  germanyAdapter,
  austriaAdapter,
  switzerlandAdapter,
  belgiumAdapter,
  netherlandsAdapter,
  luxembourgAdapter,
  spainAdapter,
  portugalAdapter,
  italyAdapter,
  estoniaAdapter,
  euViesAdapter,
];

const ADAPTER_BY_COUNTRY = new Map(
  ADAPTERS.filter((a) => a.id !== "VIES").map((a) => [a.countryCode.toUpperCase(), a]),
);

/** Fast path when no country hint (Nordic + FR + EE open registries). */
const DEFAULT_PARALLEL: RegistryAdapter[] = [
  norwayAdapter,
  swedenAdapter,
  denmarkAdapter,
  finlandAdapter,
  franceAdapter,
  estoniaAdapter,
];

/** Western Europe adapters used together with the Nordic/FR set when unhinted. */
const EXPANDED_PARALLEL: RegistryAdapter[] = [
  germanyAdapter,
  austriaAdapter,
  switzerlandAdapter,
  belgiumAdapter,
  netherlandsAdapter,
  luxembourgAdapter,
  ukAdapter,
  spainAdapter,
  portugalAdapter,
  italyAdapter,
];

const TLD_TO_COUNTRY: Record<string, string> = {
  no: "NO",
  dk: "DK",
  fi: "FI",
  fr: "FR",
  uk: "GB",
  gb: "GB",
  de: "DE",
  ee: "EE",
  se: "SE",
  nl: "NL",
  be: "BE",
  at: "AT",
  ch: "CH",
  lu: "LU",
  ie: "IE",
  it: "IT",
  es: "ES",
  pt: "PT",
  pl: "PL",
};

export function detectCountryFromDomain(domainOrUrl: string): string | undefined {
  const raw = domainOrUrl.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0] ?? "";
  const host = raw.split(":")[0] ?? "";
  if (!host.includes(".")) return undefined;

  const parts = host.split(".").filter(Boolean);
  const last = parts[parts.length - 1] ?? "";
  if (last === "uk" && parts[parts.length - 2] === "co") return "GB";
  return TLD_TO_COUNTRY[last];
}

function uniqueCodes(codes: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const code of codes) {
    const upper = code?.trim().toUpperCase();
    if (!upper || seen.has(upper)) continue;
    seen.add(upper);
    out.push(upper);
  }
  return out;
}

function inferCountriesFromQuery(query: string): string[] {
  if (parseSwedishOrgnr(query)) return ["SE"];
  const vat = parseEuVatNumber(query);
  if (vat) {
    const code =
      vat.countryCode === "EL" ? "GR" : vat.countryCode === "XI" ? "GB" : vat.countryCode;
    return [code];
  }
  if (parseSwissUid(query)) return ["CH"];

  const q = query.trim();
  if (/^\d{4}\.\d{3}\.\d{3}$/.test(q)) return ["BE"];
  if (/^\d{11}$/.test(q.replace(/[\s.\-]/g, ""))) return ["IT"];
  if (/\b(AB|HB|KB)\s*$/i.test(q)) return ["SE"];
  if (/\bSE\s*$/i.test(q)) return ["DE", "FR", "NL", "AT"];
  if (/\b(Ltd\.?|Limited|PLC|L\.?L\.?P\.?)\s*$/i.test(q)) return ["GB"];
  if (/\b(S\.?\s?L\.?U?\.?|S\.?A\.?U\.?)\s*$/i.test(q)) return ["ES"];
  if (/\b(S\.?\s?r\.?\s?l\.?|SRL|S\.?\s?p\.?\s?A\.?|SpA)\s*$/i.test(q)) return ["IT"];
  if (/\b(Lda\.?|Unipessoal)\s*$/i.test(q)) return ["PT"];
  if (/\b(BVBA|SPRL|VZW|ASBL|VOF)\s*$/i.test(q)) return ["BE"];
  if (/\b(B\.?\s?V\.?|N\.?\s?V\.?)\s*$/i.test(q)) return ["NL", "BE"];
  if (/\b(S\.?\s?à\s?r\.?\s?l\.?|Sàrl)\s*$/i.test(q)) return ["CH", "LU"];
  if (/\b(GmbH|UG|e\.K\.)\b/i.test(q)) return ["DE", "AT"];
  if (/\bAG\s*$/i.test(q)) return ["DE", "AT", "CH"];
  if (/\bHR[AB]\s*\d+/i.test(q)) return ["DE"];
  return [];
}

function normalizeKey(company: UnifiedEuropeanCompany): string {
  const name = company.legalName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const reg = company.registrationNumber.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${company.countryCode}:${reg || name}`;
}

function relevanceScore(company: UnifiedEuropeanCompany, query: string): number {
  const n = foldRegistryName(company.legalName);
  const qFull = foldRegistryName(query);
  const distinctive = foldRegistryName(query.replace(LEGAL_FORM_SUFFIX_RE, " "));
  if (qFull && n === qFull) return 0;
  if (distinctive && (n === distinctive || n === `${distinctive}ab`)) return 1;
  if (distinctive && n.startsWith(distinctive)) return 2;
  if (distinctive && n.includes(distinctive)) return 3;
  return 6;
}

function rankResults(
  rows: UnifiedEuropeanCompany[],
  query: string,
): UnifiedEuropeanCompany[] {
  const scored = rows.map((row) => ({ row, score: relevanceScore(row, query) }));
  const matched = scored.filter((item) => item.score <= 2);
  const pool = matched.length > 0 ? matched : scored;
  return pool
    .sort((a, b) => a.score - b.score || a.row.legalName.localeCompare(b.row.legalName))
    .map((item) => item.row);
}

function dedupeResults(rows: UnifiedEuropeanCompany[]): UnifiedEuropeanCompany[] {
  const seen = new Set<string>();
  const out: UnifiedEuropeanCompany[] = [];
  for (const row of rows) {
    const key = normalizeKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      ...row,
      continent: "Europe",
      legalName: row.legalName.trim(),
      registrationNumber: row.registrationNumber.trim(),
      countryCode: row.countryCode.toUpperCase(),
    });
  }
  return out;
}

async function runAdapters(
  adapters: RegistryAdapter[],
  query: string,
): Promise<UnifiedEuropeanCompany[]> {
  const settled = await Promise.allSettled(adapters.map((adapter) => adapter.search(query)));
  const rows: UnifiedEuropeanCompany[] = [];
  for (const result of settled) {
    if (result.status === "fulfilled") rows.push(...result.value);
  }
  return rows;
}

function adaptersForCountries(codes: string[]): RegistryAdapter[] {
  const adapters: RegistryAdapter[] = [];
  const seen = new Set<string>();
  for (const code of codes) {
    const adapter = ADAPTER_BY_COUNTRY.get(code);
    if (!adapter || seen.has(adapter.id)) continue;
    seen.add(adapter.id);
    adapters.push(adapter);
  }
  return adapters;
}

/**
 * Search Pan-European business registries.
 * - If query looks like an EU VAT number → VIES first.
 * - If country hint / domain TLD / legal-form suffix → those adapters first.
 * - Otherwise Nordic + FR + EE together with DE/AT/CH/Benelux/UK/ES/PT/IT.
 */
export async function searchEuropeanRegisters(
  query: string,
  countryCodeHintOrOptions?: string | EuropeanRegistrySearchOptions,
): Promise<UnifiedEuropeanCompany[]> {
  const options: EuropeanRegistrySearchOptions =
    typeof countryCodeHintOrOptions === "string"
      ? { countryCodeHint: countryCodeHintOrOptions }
      : (countryCodeHintOrOptions ?? {});

  const q = query.trim();
  if (!q) return [];

  const limit = options.limit ?? 12;
  const hintFromDomain = options.domainHint
    ? detectCountryFromDomain(options.domainHint)
    : detectCountryFromDomain(q);
  const countryHints = uniqueCodes([
    options.countryCodeHint,
    hintFromDomain,
    ...inferCountriesFromQuery(q),
  ]);

  // VAT-shaped queries always try VIES.
  if (parseEuVatNumber(q)) {
    const viesHits = await euViesAdapter.search(q);
    if (viesHits.length > 0) return dedupeResults(viesHits).slice(0, limit);
  }

  const primaryAdapters = adaptersForCountries(countryHints);
  const searched = new Set(primaryAdapters.map((adapter) => adapter.id));

  if (primaryAdapters.length > 0) {
    const primaryHits = await runAdapters(primaryAdapters, q);
    if (primaryHits.length > 0) {
      return rankResults(dedupeResults(primaryHits), q).slice(0, limit);
    }
  }

  const fallbackAdapters: RegistryAdapter[] = [];
  for (const adapter of [...DEFAULT_PARALLEL, ...EXPANDED_PARALLEL]) {
    if (searched.has(adapter.id)) continue;
    searched.add(adapter.id);
    fallbackAdapters.push(adapter);
  }

  const fallbackHits = await runAdapters(fallbackAdapters, q);
  return rankResults(dedupeResults(fallbackHits), q).slice(0, limit);
}

export function listRegistryAdapters(): Array<{
  id: string;
  countryCode: string;
  sourceRegistry: string;
}> {
  return ADAPTERS.map((a) => ({
    id: a.id,
    countryCode: a.countryCode,
    sourceRegistry: a.sourceRegistry,
  }));
}
