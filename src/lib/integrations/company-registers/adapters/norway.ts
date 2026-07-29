import {
  cleanText,
  emptyCompany,
  fetchRegistryJson,
  firstString,
} from "@/lib/integrations/company-registers/http";
import type {
  RegistryAdapter,
  UnifiedEuropeanCompany,
} from "@/lib/integrations/company-registers/types";

type BrregEnhet = {
  organisasjonsnummer?: string;
  navn?: string;
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
    sourceRegistry: "Brønnøysundregistrene (NO)",
  });
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
