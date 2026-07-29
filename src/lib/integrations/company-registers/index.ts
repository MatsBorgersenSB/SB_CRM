import { denmarkAdapter } from "@/lib/integrations/company-registers/adapters/denmark";
import { estoniaAdapter } from "@/lib/integrations/company-registers/adapters/estonia";
import { euViesAdapter, parseEuVatNumber } from "@/lib/integrations/company-registers/adapters/eu-vies";
import { finlandAdapter } from "@/lib/integrations/company-registers/adapters/finland";
import { franceAdapter } from "@/lib/integrations/company-registers/adapters/france";
import { germanyAdapter } from "@/lib/integrations/company-registers/adapters/germany";
import { norwayAdapter } from "@/lib/integrations/company-registers/adapters/norway";
import { ukAdapter } from "@/lib/integrations/company-registers/adapters/uk";
import type {
  EuropeanRegistrySearchOptions,
  RegistryAdapter,
  UnifiedEuropeanCompany,
} from "@/lib/integrations/company-registers/types";

export type { UnifiedEuropeanCompany, EuropeanRegistrySearchOptions } from "@/lib/integrations/company-registers/types";

const ADAPTERS: RegistryAdapter[] = [
  norwayAdapter,
  denmarkAdapter,
  finlandAdapter,
  franceAdapter,
  ukAdapter,
  germanyAdapter,
  estoniaAdapter,
  euViesAdapter,
];

const ADAPTER_BY_COUNTRY = new Map(
  ADAPTERS.filter((a) => a.id !== "VIES").map((a) => [a.countryCode.toUpperCase(), a]),
);

/** Default parallel set when no country hint (Nordic + major EU open registries). */
const DEFAULT_PARALLEL: RegistryAdapter[] = [
  norwayAdapter,
  denmarkAdapter,
  finlandAdapter,
  franceAdapter,
  estoniaAdapter,
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

function normalizeKey(company: UnifiedEuropeanCompany): string {
  const name = company.legalName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const reg = company.registrationNumber.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${company.countryCode}:${reg || name}`;
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

/**
 * Search Pan-European business registries.
 * - If query looks like an EU VAT number → VIES first.
 * - If country hint / domain TLD → that adapter first, then fill from default set.
 * - Otherwise parallel Nordic + FR + EE open registries.
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
  const countryHint = (options.countryCodeHint ?? hintFromDomain)?.toUpperCase();

  // VAT-shaped queries always try VIES.
  if (parseEuVatNumber(q)) {
    const viesHits = await euViesAdapter.search(q);
    if (viesHits.length > 0) return dedupeResults(viesHits).slice(0, limit);
  }

  const primary = countryHint ? ADAPTER_BY_COUNTRY.get(countryHint) : undefined;

  if (primary) {
    const primaryHits = await primary.search(q);
    if (primaryHits.length > 0) {
      // Optionally enrich with a light parallel fill from defaults (excluding primary).
      const others = DEFAULT_PARALLEL.filter((a) => a.countryCode !== primary.countryCode);
      const extra = await runAdapters(others.slice(0, 2), q);
      return dedupeResults([...primaryHits, ...extra]).slice(0, limit);
    }
    // Primary empty → fall through to parallel defaults.
  }

  const parallel = await runAdapters(DEFAULT_PARALLEL, q);
  return dedupeResults(parallel).slice(0, limit);
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
