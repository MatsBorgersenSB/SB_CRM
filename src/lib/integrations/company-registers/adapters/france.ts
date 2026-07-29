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

type FrResult = {
  siren?: string;
  nom_complet?: string;
  nom_raison_sociale?: string;
  siret?: string;
  activite_principale?: string;
  libelle_activite_principale?: string;
  siege?: {
    adresse?: string;
    code_postal?: string;
    libelle_commune?: string;
    commune?: string;
    numero_voie?: string;
    type_voie?: string;
    libelle_voie?: string;
  };
  dirigeants?: Array<{
    nom?: string;
    prenoms?: string;
    qualite?: string;
  }>;
};

type FrResponse = {
  results?: FrResult[];
};

function mapFr(row: FrResult): UnifiedEuropeanCompany | null {
  const legalName = firstString(row.nom_complet, row.nom_raison_sociale);
  const registrationNumber = cleanText(row.siren);
  if (!legalName || !registrationNumber) return null;

  const siege = row.siege;
  const street =
    cleanText(siege?.adresse) ||
    [siege?.numero_voie, siege?.type_voie, siege?.libelle_voie]
      .map(cleanText)
      .filter(Boolean)
      .join(" ");

  const executives = (row.dirigeants ?? [])
    .map((person) =>
      [cleanText(person.prenoms), cleanText(person.nom)].filter(Boolean).join(" "),
    )
    .filter(Boolean);

  return emptyCompany({
    legalName,
    registrationNumber,
    vatNumber: undefined,
    country: "France",
    countryCode: "FR",
    streetAddress: street || undefined,
    postalCode: cleanText(siege?.code_postal) || undefined,
    city: firstString(siege?.libelle_commune, siege?.commune) || undefined,
    industryCode: cleanText(row.activite_principale) || undefined,
    industryDescription: cleanText(row.libelle_activite_principale) || undefined,
    executives: executives.length > 0 ? executives : undefined,
    sourceRegistry: "Recherche Entreprises (FR)",
  });
}

export const franceAdapter: RegistryAdapter = {
  id: "FR",
  countryCode: "FR",
  sourceRegistry: "Recherche Entreprises (FR)",
  async search(query: string): Promise<UnifiedEuropeanCompany[]> {
    const q = query.trim();
    if (!q) return [];

    const url = `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(q)}&per_page=8`;
    const data = await fetchRegistryJson<FrResponse>(url);
    const results = data?.results ?? [];
    return results
      .map(mapFr)
      .filter((row): row is UnifiedEuropeanCompany => Boolean(row));
  },
};
