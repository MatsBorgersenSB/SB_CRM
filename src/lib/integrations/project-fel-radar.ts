/**
 * Project FEL External Truth Radar (Integrations 2, 3 & 4)
 *
 * Queries authoritative external registries and verified rule catalogs to propose
 * cited SourceFinding items across the 7 FEL development pillars:
 * 1. Kartverket / Geonorge Open Address & Matrikkel API (Pillar 1: site_readiness)
 * 2. Brønnøysundregistrene + Regional Statsforvalteren / Miljødirektoratet Permit Radar (Pillar 7: permitting)
 * 3. Cited Enova & Innovasjon Norge Industrial Bioenergy/Pyrolysis Programs (Pillar 6: public_funding)
 * 4. Puro.earth Biochar CORC Carbon Removal Standard (Pillar 5: end_product)
 *
 * Reality First:
 * - Never writes directly to confirmed fields; returns unconfirmed SourceFinding proposals
 *   with explicit source URLs and impact.
 * - Tags Standard Bio plant findings with plantScope: "our_plant".
 */

import { fetchRegistryJson } from "@/lib/integrations/company-registers/http";
import { createSourceFinding, type SourceFinding } from "@/lib/source-findings";

type GeonorgeAdresse = {
  adressetekst?: string;
  poststed?: string;
  postnummer?: string;
  kommunenavn?: string;
  kommunenummer?: string;
  gardsnummer?: number;
  bruksnummer?: number;
  representasjonspunkt?: { lat?: number; lon?: number };
};

type GeonorgeResponse = {
  adresser?: GeonorgeAdresse[];
};

type BrregEnhet = {
  organisasjonsnummer?: string;
  navn?: string;
  naeringskode1?: { kode?: string; beskrivelse?: string };
  forretningsadresse?: {
    adresse?: string[];
    postnummer?: string;
    poststed?: string;
    kommunenummer?: string;
    kommune?: string;
  };
};

type BrregSearchResponse = {
  _embedded?: { enheter?: BrregEnhet[] };
};

/** Maps Norwegian county prefix (first 2 digits of kommunenummer) to the competent Statsforvalteren authority. */
function statsforvalterenForKommune(kommunenummer?: string): string {
  const prefix = (kommunenummer ?? "").trim().slice(0, 2);
  switch (prefix) {
    case "03":
    case "31":
    case "32":
    case "33":
      return "Statsforvalteren i Østfold, Buskerud, Oslo og Akershus";
    case "34":
      return "Statsforvalteren i Innlandet";
    case "39":
    case "40":
      return "Statsforvalteren i Vestfold og Telemark";
    case "42":
      return "Statsforvalteren i Agder";
    case "11":
      return "Statsforvalteren i Rogaland";
    case "46":
      return "Statsforvalteren i Vestland";
    case "15":
      return "Statsforvalteren i Møre og Romsdal";
    case "50":
      return "Statsforvalteren i Trøndelag";
    case "18":
      return "Statsforvalteren i Nordland";
    case "55":
    case "56":
      return "Statsforvalteren i Troms og Finnmark";
    default:
      return "Statsforvalteren / Miljødirektoratet";
  }
}

export type ExternalFelRadarInput = {
  projectId: string;
  projectName: string;
  siteQuery?: string;
  counterpartyNames: string[];
  /** Optional FEL 1 mass/energy numbers when feedstock volume is already known. */
  netExportThermalGwhPerYear?: number;
  biocharTonnesPerYear?: number;
  corcTonnesCo2ePerYear?: number;
};

/**
 * 1. Kartverket / Geonorge Site, Municipality & Cadastral Parcel Lookup (Pillar 1)
 */
export async function lookupKartverketSiteFinding(
  query: string,
): Promise<SourceFinding | null> {
  const cleaned = query.trim();
  if (cleaned.length < 3) return null;

  const url = `https://ws.geonorge.no/adresser/v1/sok?sok=${encodeURIComponent(cleaned)}&treffPerSide=3`;
  const data = await fetchRegistryJson<GeonorgeResponse>(url, { timeoutMs: 3500 });
  const first = data?.adresser?.[0];
  if (!first?.kommunenavn) return null;

  const kommune = `${first.kommunenavn}${first.kommunenummer ? ` (kommune ${first.kommunenummer})` : ""}`;
  const cadastre =
    typeof first.gardsnummer === "number" && typeof first.bruksnummer === "number"
      ? `, cadastral parcel gnr. ${first.gardsnummer} / bnr. ${first.bruksnummer}`
      : "";
  const coords =
    typeof first.representasjonspunkt?.lat === "number" &&
    typeof first.representasjonspunkt?.lon === "number"
      ? ` at ${first.representasjonspunkt.lat.toFixed(4)}°N, ${first.representasjonspunkt.lon.toFixed(4)}°E`
      : "";
  const addrLabel = first.adressetekst
    ? `${first.adressetekst}, ${first.postnummer ?? ""} ${first.poststed ?? ""}`.trim()
    : cleaned;

  return createSourceFinding({
    title: `Kartverket / Geonorge Matrikkel: ${first.kommunenavn}`,
    url: "https://seeiendom.kartverket.no/",
    note: `kartverket:${first.kommunenummer ?? ""}:${first.gardsnummer ?? ""}-${first.bruksnummer ?? ""}`,
    kind: "url",
    claims: [
      {
        id: "kartverket-site",
        statement: `Kartverket registry locates site reference (${addrLabel}) in ${kommune}${cadastre}${coords}. Verify industrial zoning (kommuneplanens arealdel) and lease/purchase boundary on this parcel.`,
        impact:
          "Establishes official municipal jurisdiction and cadastral parcel (gnr/bnr) for land lease agreements and local planning approval.",
        fieldId: "site_readiness",
        plantScope: "our_plant",
      },
    ],
  });
}

/**
 * 2. Brønnøysund & Regional Environmental Permit Authority Radar (Pillar 7)
 */
export async function lookupPermitAndAuthorityFinding(
  counterpartyOrProjectQuery: string,
  siteKommuneNo?: string,
  siteKommuneName?: string,
): Promise<SourceFinding | null> {
  const cleaned = counterpartyOrProjectQuery.trim();
  if (cleaned.length < 3) return null;

  const brregUrl = `https://data.brreg.no/enhetsregisteret/api/enheter?navn=${encodeURIComponent(cleaned)}&size=3`;
  const data = await fetchRegistryJson<BrregSearchResponse>(brregUrl, { timeoutMs: 3500 });
  const enhet = data?._embedded?.enheter?.[0];

  // Physical plant site municipality governs Statsforvalteren jurisdiction when known
  const kommuneNo = siteKommuneNo || enhet?.forretningsadresse?.kommunenummer;
  const kommuneName =
    siteKommuneName ||
    enhet?.forretningsadresse?.kommune ||
    enhet?.forretningsadresse?.poststed;
  const authority = statsforvalterenForKommune(kommuneNo);
  const orgNr = enhet?.organisasjonsnummer;
  const nace = enhet?.naeringskode1?.kode
    ? `NACE ${enhet.naeringskode1.kode} (${enhet.naeringskode1.beskrivelse ?? "industrial"})`
    : null;

  const entityLabel = enhet?.navn
    ? `${enhet.navn}${orgNr ? ` (org.nr ${orgNr})` : ""}`
    : cleaned;

  return createSourceFinding({
    title: `Regulatory & Permit Radar: ${authority}`,
    url: "https://www.norskeutslipp.no/",
    note: `permit-radar:${orgNr ?? cleaned.toLowerCase()}`,
    kind: "url",
    claims: [
      {
        id: "authority-permitting-pathway",
        statement: `Regional permitting authority for ${entityLabel}${kommuneName ? ` (plant site: ${kommuneName})` : ""} is ${authority}${nace ? ` [${nace}]` : ""}. Standard Bio's pyrolysis and dryer installation requires separate permit / co-location clearance under Forurensningsloven kap. 11.`,
        impact:
          "Identifies the exact regional pollution authority and legal pathway required to permit our plant independently of the host facility.",
        fieldId: "permitting",
        plantScope: "our_plant",
      },
    ],
  });
}

/**
 * 3 & 4. Cited Public Subsidy (`Enova` / `Innovasjon Norge`) & `Puro.earth` CORC Carbon Registry Feed
 */
export function buildCitedSubsidyAndCarbonFindings(
  input: ExternalFelRadarInput,
): SourceFinding[] {
  const heatDetail =
    typeof input.netExportThermalGwhPerYear === "number" && input.netExportThermalGwhPerYear > 0
      ? ` (~${input.netExportThermalGwhPerYear} GWh/yr net thermal energy recovery and ${input.biocharTonnesPerYear?.toLocaleString("en-US") ?? ""} t/yr biochar basis)`
      : "";

  const corcDetail =
    typeof input.corcTonnesCo2ePerYear === "number" && input.corcTonnesCo2ePerYear > 0
      ? ` (~${input.corcTonnesCo2ePerYear.toLocaleString("en-US")} tCO2e/yr estimated CORC volume from ${input.biocharTonnesPerYear?.toLocaleString("en-US") ?? ""} t/yr biochar)`
      : "";

  const subsidyFinding = createSourceFinding({
    title: "Enova & Innovasjon Norge — Industrial Climate & Bioenergy Programs",
    url: "https://www.enova.no/bedrift/industri-og-anlegg/",
    note: `subsidy-radar:${input.projectId}`,
    kind: "url",
    claims: [
      {
        id: "enova-innovation-norway-subsidy",
        statement: `Cited public funding programs applicable to ${input.projectName}${heatDetail}: (1) Enova 'Klima- og energisatsinger i industrien' (capital grant for biogenic heat recovery & carbon-negative pyrolysis) and (2) Innovasjon Norge 'Miljøteknologiordningen / Grønn industrifinansiering' (must be applied for prior to binding equipment order / FID).`,
        impact:
          "Public grant applications must be submitted before Formal Investment Decision (incentive effect rule) to qualify for 25–45% eligible CAPEX support.",
        fieldId: "public_funding",
        plantScope: "our_plant",
      },
    ],
  });

  const puroFinding = createSourceFinding({
    title: "Puro.earth Standard — Biochar Carbon Removal (CORC) Registry",
    url: "https://puro.earth/biochar",
    note: `carbon-radar:${input.projectId}`,
    kind: "url",
    claims: [
      {
        id: "puro-corc-methodology",
        statement: `Puro.earth Biochar Methodology eligibility for ${input.projectName}${corcDetail}: requires sustainable biomass feedstock traceability (FSC/PEFC or G30 forestry), molar H/C_org ratio < 0.70 (EBC lab verification), and non-oxidative end-use registration to issue tradeable CORCs.`,
        impact:
          "Defines the technical lab certification and feedstock audit trail required to monetize carbon removal credits alongside physical biochar sales.",
        fieldId: "end_product",
        plantScope: "our_plant",
      },
    ],
  });

  return [subsidyFinding, puroFinding];
}

/**
 * Orchestrates all external FEL truth adapters in parallel with safe timeouts.
 */
export async function runProjectExternalFelRadar(
  input: ExternalFelRadarInput,
): Promise<SourceFinding[]> {
  const siteCandidate =
    input.siteQuery?.trim() ||
    input.projectName
      .replace(/^antec\s*[-–]?\s*/i, "")
      .trim() ||
    input.counterpartyNames[0] ||
    "";

  const counterpartyCandidate =
    input.counterpartyNames[0] || input.projectName.split(/[-–]/)[0]?.trim() || "";

  const siteFinding = siteCandidate
    ? await lookupKartverketSiteFinding(siteCandidate).catch(() => null)
    : null;

  // Extract kommunenummer from kartverket note ("kartverket:1577:181-13") and kommunenavn from title
  const siteKommuneNo = siteFinding?.note?.split(":")[1] || undefined;
  const siteKommuneName = siteFinding?.title?.split(":")[1]?.trim() || undefined;

  const permitFinding = counterpartyCandidate
    ? await lookupPermitAndAuthorityFinding(
        counterpartyCandidate,
        siteKommuneNo,
        siteKommuneName,
      ).catch(() => null)
    : null;

  const out: SourceFinding[] = [];
  if (siteFinding) out.push(siteFinding);
  if (permitFinding) out.push(permitFinding);
  out.push(...buildCitedSubsidyAndCarbonFindings(input));

  return out;
}
