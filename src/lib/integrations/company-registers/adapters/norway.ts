import {
  cleanText,
  emptyCompany,
  fetchRegistryJson,
  firstString,
} from "@/lib/integrations/company-registers/http";
import type {
  RegistryAdapter,
  RegistryOfficer,
  UnifiedEuropeanCompany,
} from "@/lib/integrations/company-registers/types";

type BrregEnhet = {
  organisasjonsnummer?: string;
  navn?: string;
  hjemmeside?: string;
  organisasjonsform?: { beskrivelse?: string };
  naeringskode1?: { kode?: string; beskrivelse?: string };
  forretningsadresse?: {
    adresse?: string[];
    postnummer?: string;
    poststed?: string;
    land?: string;
    landkode?: string;
  };
  postadresse?: {
    adresse?: string[];
    postnummer?: string;
    poststed?: string;
    land?: string;
  };
};

type BrregResponse = {
  _embedded?: { enheter?: BrregEnhet[] };
};

function mapEnhet(enhet: BrregEnhet): UnifiedEuropeanCompany | null {
  const legalName = cleanText(enhet.navn);
  const registrationNumber = cleanText(enhet.organisasjonsnummer);
  if (!legalName || !registrationNumber) return null;

  const address = enhet.forretningsadresse ?? enhet.postadresse;
  const street = Array.isArray(address?.adresse)
    ? address!.adresse!.map(cleanText).filter(Boolean).join(", ")
    : "";

  return emptyCompany({
    legalName,
    registrationNumber,
    vatNumber: registrationNumber ? `NO${registrationNumber}MVA` : undefined,
    country: firstString(address?.land, "Norway"),
    countryCode: "NO",
    streetAddress: street || undefined,
    postalCode: cleanText(address?.postnummer) || undefined,
    city: cleanText(address?.poststed) || undefined,
    industryCode: cleanText(enhet.naeringskode1?.kode) || undefined,
    industryDescription: cleanText(enhet.naeringskode1?.beskrivelse) || undefined,
    website: cleanText(enhet.hjemmeside) || undefined,
    sourceRegistry: "Brønnøysundregistrene (NO)",
  });
}

type BrregRolle = {
  type?: { kode?: string; beskrivelse?: string };
  person?: {
    navn?: { fornavn?: string; mellomnavn?: string; etternavn?: string };
    erDoed?: boolean;
  };
  enhet?: unknown;
  fratraadt?: boolean;
};

type BrregRoller = {
  rollegrupper?: Array<{
    type?: { kode?: string; beskrivelse?: string };
    roller?: BrregRolle[];
  }>;
};

/** Role groups that are not people we would ever contact about business. */
const SKIPPED_ROLE_GROUPS = new Set(["REVI", "REGN", "KOMP", "KDEB", "KENK", "FFØR"]);

/**
 * Named officers for a Norwegian organisation number — CEO, chair, board,
 * contact person. Public data; resigned and deceased holders are excluded.
 */
export async function fetchNorwayOfficers(orgnr: string): Promise<RegistryOfficer[]> {
  const id = orgnr.replace(/\s/g, "");
  if (!/^\d{9}$/.test(id)) return [];
  const data = await fetchRegistryJson<BrregRoller>(
    `https://data.brreg.no/enhetsregisteret/api/enheter/${id}/roller`,
  );
  const officers: RegistryOfficer[] = [];
  const seen = new Set<string>();
  for (const group of data?.rollegrupper ?? []) {
    const groupCode = cleanText(group.type?.kode);
    if (SKIPPED_ROLE_GROUPS.has(groupCode)) continue;
    for (const role of group.roller ?? []) {
      if (role.fratraadt || role.person?.erDoed || role.enhet) continue;
      const navn = role.person?.navn;
      const name = [navn?.fornavn, navn?.mellomnavn, navn?.etternavn]
        .map(cleanText)
        .filter(Boolean)
        .join(" ");
      if (!name) continue;
      const roleLabel = firstString(role.type?.beskrivelse, group.type?.beskrivelse);
      const key = `${name}|${roleLabel}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      officers.push({ name, role: roleLabel });
    }
  }
  return officers;
}

export const norwayAdapter: RegistryAdapter = {
  id: "NO",
  countryCode: "NO",
  sourceRegistry: "Brønnøysundregistrene (NO)",
  async search(query: string): Promise<UnifiedEuropeanCompany[]> {
    const q = query.trim();
    if (!q) return [];

    // Prefer exact orgnr lookup when query looks like 9 digits.
    if (/^\d{9}$/.test(q.replace(/\s/g, ""))) {
      const orgnr = q.replace(/\s/g, "");
      const byId = await fetchRegistryJson<BrregEnhet>(
        `https://data.brreg.no/enhetsregisteret/api/enheter/${orgnr}`,
      );
      const mapped = byId ? mapEnhet(byId) : null;
      return mapped ? [mapped] : [];
    }

    const url = `https://data.brreg.no/enhetsregisteret/api/enheter?navn=${encodeURIComponent(q)}&size=8`;
    const data = await fetchRegistryJson<BrregResponse>(url);
    const enheter = data?._embedded?.enheter ?? [];
    return enheter
      .map(mapEnhet)
      .filter((row): row is UnifiedEuropeanCompany => Boolean(row));
  },
};
