/**
 * FEL 1 Mass, Energy & Bankability Engine
 *
 * Deterministic engineering mass-and-energy balance for Standard Bio pyrolysis
 * plants (FEL 1 -> Realisation). Never invents unstated project facts:
 * - Reads captured/confirmed feedstock volume, moisture/dry-matter %, and feedstock kind
 *   from the record (or explicit simulator overrides).
 * - Separates "captured" inputs from "standard FEL 1 baseline" engineering constants.
 * - Computes hourly throughput, dryer duty, reactor line count, net exportable thermal
 *   energy (GWh/yr for Pillar 4), biochar output (t/yr for Pillar 5), and Puro.earth CORC
 *   carbon removal potential (tCO2e/yr).
 */

import type { PipelineRow } from "@/types/pipeline";
import type { UnderstandingFieldId } from "@/types/opportunity-understanding";

export type FeedstockArchetype = "wood_chips" | "digestate" | "sludge" | "mixed_biomass";

export type FelMassEnergyInput = {
  /** Wet feedstock input in tonnes/year. */
  wetTonnesPerYear: number;
  /** Optional range label when parsed from text like "8 000 til 10 000 t/år". */
  wetTonnesRangeLabel?: string;
  /** Inlet moisture mass fraction (0..0.85), e.g. 0.30 for G30 wood chips. */
  inletMoistureFraction: number;
  /** Whether inlet moisture was explicitly captured from evidence or is an archetype baseline. */
  moistureSource: "captured" | "baseline";
  /** Target moisture entering the pyrolysis reactor (default 0.15 = 85% dry matter). */
  targetReactorMoistureFraction?: number;
  /** Feedstock archetype. */
  archetype: FeedstockArchetype;
  /** Annual operating hours (default 7,500 h/yr). */
  operatingHoursPerYear?: number;
};

export type FelMassEnergyResult = {
  ready: true;
  input: Required<Omit<FelMassEnergyInput, "wetTonnesRangeLabel">> & {
    wetTonnesRangeLabel?: string;
  };
  /** Dry matter input (t DM/yr). */
  dryMatterTonnesPerYear: number;
  /** Wet throughput (kg/h). */
  wetKgPerHour: number;
  /** Dry matter throughput (kg DM/h). */
  dryKgPerHour: number;
  /** Water evaporated in the pre-dryer to reach target reactor moisture (t H2O/yr). */
  evaporatedWaterTonnesPerYear: number;
  /** Thermal duty consumed by pre-drying (GWh/yr). */
  dryerThermalDutyGwhPerYear: number;
  /** Gross pyrolysis thermal energy generated (GWh/yr). */
  grossThermalGwhPerYear: number;
  /** Net surplus thermal energy available for host offtake / district heat (GWh/yr, Pillar 4). */
  netExportThermalGwhPerYear: number;
  /** Net export thermal power (MW_th at operating hours). */
  netExportThermalMw: number;
  /** Recommended number of Standard Bio pyrolysis reactor lines. */
  reactorLines: number;
  /** Annual biochar output (t/yr, Pillar 5). */
  biocharTonnesPerYear: number;
  /** Estimated Puro.earth CORC carbon removal certificates (tCO2e/yr, Pillar 5). */
  corcTonnesCo2ePerYear: number;
  /** Approximate electrical parasitic load for pyrolysis + dryer fans/conveyors (kW_e, Pillar 3). */
  estimatedElectricalLoadKw: number;
  /** One-sentence prose summary for each FEL pillar that this mass balance informs. */
  pillarSummaries: Partial<Record<UnderstandingFieldId, string>>;
};

export type FelMassEnergyMissing = {
  ready: false;
  missingReason: string;
  archetype: FeedstockArchetype;
};

export type FelMassEnergyEvaluation = FelMassEnergyResult | FelMassEnergyMissing;

const ARCHETYPE_DEFAULTS: Record<
  FeedstockArchetype,
  {
    label: string;
    defaultInletMoisture: number;
    /** Biochar yield as fraction of dry matter input. */
    biocharYieldPerDryTonne: number;
    /** Gross recoverable syngas thermal energy (MWh_th per tonne dry matter). */
    grossThermalMwhPerDryTonne: number;
    /** Net CORC factor (tCO2e per tonne dry biochar, Puro.earth methodology). */
    corcPerBiocharTonne: number;
  }
> = {
  wood_chips: {
    label: "Wood chips (G30 / forestry)",
    defaultInletMoisture: 0.3,
    biocharYieldPerDryTonne: 0.27,
    grossThermalMwhPerDryTonne: 1.45,
    corcPerBiocharTonne: 2.65,
  },
  digestate: {
    label: "Dried biogas digestate / biorest",
    defaultInletMoisture: 0.45,
    biocharYieldPerDryTonne: 0.34,
    grossThermalMwhPerDryTonne: 1.05,
    corcPerBiocharTonne: 1.65,
  },
  sludge: {
    label: "Aquaculture / industrial sludge",
    defaultInletMoisture: 0.5,
    biocharYieldPerDryTonne: 0.38,
    grossThermalMwhPerDryTonne: 0.95,
    corcPerBiocharTonne: 1.4,
  },
  mixed_biomass: {
    label: "Residual biomass",
    defaultInletMoisture: 0.35,
    biocharYieldPerDryTonne: 0.28,
    grossThermalMwhPerDryTonne: 1.3,
    corcPerBiocharTonne: 2.3,
  },
};

export function formatArchetypeLabel(archetype: FeedstockArchetype): string {
  return ARCHETYPE_DEFAULTS[archetype].label;
}

/**
 * Pure deterministic physics calculation for FEL 1 mass & energy balance.
 */
export function computeFelMassEnergyBalance(input: FelMassEnergyInput): FelMassEnergyResult {
  const hours = input.operatingHoursPerYear ?? 7500;
  const targetMoisture = input.targetReactorMoistureFraction ?? 0.15;
  const spec = ARCHETYPE_DEFAULTS[input.archetype];

  const wetTonnes = Math.max(0, input.wetTonnesPerYear);
  const inletMoisture = Math.min(0.85, Math.max(0.05, input.inletMoistureFraction));
  const dryMatterTonnesPerYear = Math.round(wetTonnes * (1 - inletMoisture));

  const wetKgPerHour = Math.round((wetTonnes * 1000) / hours);
  const dryKgPerHour = Math.round((dryMatterTonnesPerYear * 1000) / hours);

  // Mass after drying to targetMoisture: dryMatter / (1 - targetMoisture)
  const postDryerWetTonnes =
    inletMoisture > targetMoisture
      ? dryMatterTonnesPerYear / (1 - targetMoisture)
      : wetTonnes;
  const evaporatedWaterTonnesPerYear = Math.max(0, Math.round(wetTonnes - postDryerWetTonnes));

  // Specific thermal energy of belt/drum dryer ~0.88 MWh_th per tonne water evaporated
  const dryerThermalDutyMwh = evaporatedWaterTonnesPerYear * 0.88;
  const dryerThermalDutyGwhPerYear = Number((dryerThermalDutyMwh / 1000).toFixed(2));

  const grossThermalMwh = dryMatterTonnesPerYear * spec.grossThermalMwhPerDryTonne;
  const grossThermalGwhPerYear = Number((grossThermalMwh / 1000).toFixed(2));

  const netExportThermalGwhPerYear = Number(
    Math.max(0, grossThermalGwhPerYear - dryerThermalDutyGwhPerYear).toFixed(1),
  );
  const netExportThermalMw = Number(((netExportThermalGwhPerYear * 1000) / hours).toFixed(2));

  // Standard Bio modular pyrolysis line capacity ~650 kg DM/h per line
  const reactorLines = Math.max(1, Math.ceil(dryKgPerHour / 650));

  const biocharTonnesPerYear = Math.round(
    dryMatterTonnesPerYear * spec.biocharYieldPerDryTonne,
  );
  const corcTonnesCo2ePerYear = Math.round(biocharTonnesPerYear * spec.corcPerBiocharTonne);

  // Electrical auxiliary power (~180 kW per pyrolysis line + dryer fan allowance)
  const estimatedElectricalLoadKw = Math.round(
    reactorLines * 185 + (evaporatedWaterTonnesPerYear / hours) * 90,
  );

  const volLabel = input.wetTonnesRangeLabel ?? `${wetTonnes.toLocaleString("en-US")} t/yr`;
  const moisturePct = Math.round(inletMoisture * 100);
  const dmPct = 100 - moisturePct;

  const pillarSummaries: Partial<Record<UnderstandingFieldId, string>> = {
    feedstock_agreement: `FEL 1 basis: ${volLabel} ${spec.label.toLowerCase()} at ${moisturePct}% moisture (${dmPct}% dry matter = ${dryMatterTonnesPerYear.toLocaleString("en-US")} t DM/yr, ~${wetKgPerHour} kg/h wet).`,
    utilities: `FEL 1 utility interface: ~${estimatedElectricalLoadKw} kWe electrical load (${reactorLines} reactor line${reactorLines === 1 ? "" : "s"}), pre-dryer evaporating ${evaporatedWaterTonnesPerYear.toLocaleString("en-US")} t H2O/yr (${dryerThermalDutyGwhPerYear} GWh/yr internal heat), plus thermal tie-in for ${netExportThermalMw} MWth export.`,
    offtake_strategy: `FEL 1 thermal output: ~${netExportThermalGwhPerYear} GWh/yr (${netExportThermalMw} MWth baseload) net surplus thermal heat available for host offtake after self-drying.`,
    end_product: `FEL 1 biochar & carbon output: ~${biocharTonnesPerYear.toLocaleString("en-US")} t/yr dry biochar generating ~${corcTonnesCo2ePerYear.toLocaleString("en-US")} tCO2e/yr in Puro.earth CORCs.`,
    capacity: `FEL 1 sizing: ${reactorLines} Standard Bio pyrolysis line${reactorLines === 1 ? "" : "s"} (${dryKgPerHour} kg DM/h, ${netExportThermalGwhPerYear} GWh/yr net heat, ${biocharTonnesPerYear.toLocaleString("en-US")} t/yr biochar).`,
  };

  return {
    ready: true,
    input: {
      wetTonnesPerYear: wetTonnes,
      wetTonnesRangeLabel: input.wetTonnesRangeLabel,
      inletMoistureFraction: inletMoisture,
      moistureSource: input.moistureSource,
      targetReactorMoistureFraction: targetMoisture,
      archetype: input.archetype,
      operatingHoursPerYear: hours,
    },
    dryMatterTonnesPerYear,
    wetKgPerHour,
    dryKgPerHour,
    evaporatedWaterTonnesPerYear,
    dryerThermalDutyGwhPerYear,
    grossThermalGwhPerYear,
    netExportThermalGwhPerYear,
    netExportThermalMw,
    reactorLines,
    biocharTonnesPerYear,
    corcTonnesCo2ePerYear,
    estimatedElectricalLoadKw,
    pillarSummaries,
  };
}

function parseNumberToken(raw: string): number | null {
  const cleaned = raw.replace(/[\s\u00A0.]/g, "").replace(",", ".");
  const num = Number(cleaned);
  return Number.isFinite(num) && num > 0 ? num : null;
}

/**
 * Extracts annual feedstock volume (t/yr) and moisture/dry-matter % from captured
 * understanding fields and confirmed/proposed findings on a deal or project.
 */
export function evaluatePipelineFelMassEnergy(
  pipeline: PipelineRow,
  overrideTonnesPerYear?: number | null,
  overrideMoisturePct?: number | null,
): FelMassEnergyEvaluation {
  const fields = pipeline.understanding?.fields ?? {};
  const findings = pipeline.understanding?.findings ?? [];

  const feedstockClaims = findings
    .flatMap((f) => f.claims)
    .filter(
      (c) =>
        c.decision !== "dismissed" &&
        (c.fieldId === "feedstock_agreement" ||
          c.fieldId === "feedstock_volume" ||
          c.fieldId === "feedstock_quality" ||
          c.fieldId === "offtake_strategy"),
    )
    .map((c) => c.statement);

  const corpus = [
    fields.feedstock_agreement,
    fields.feedstock_volume,
    fields.feedstock_quality,
    pipeline.targetFeedstock,
    ...feedstockClaims,
  ]
    .filter(Boolean)
    .join(" \n ");

  const archetype: FeedstockArchetype =
    /\b(wood\s*chips?|g30|treflis|flis|forestry|timber|sawdust)\b/i.test(corpus)
      ? "wood_chips"
      : /\b(digestate|biorest|husdyrgjødsel)\b/i.test(corpus)
        ? "digestate"
        : /\b(sludge|fiskeslam|slam|aquaculture)\b/i.test(corpus)
          ? "sludge"
          : "wood_chips";

  let wetTonnesPerYear: number | null =
    typeof overrideTonnesPerYear === "number" && overrideTonnesPerYear > 0
      ? overrideTonnesPerYear
      : null;
  let wetTonnesRangeLabel: string | undefined;

  if (!wetTonnesPerYear) {
    // Match range first, e.g. "8 000 til 10 000 t/år" or "8,000-10,000 t/yr"
    const rangeMatch = corpus.match(
      /\b(\d{1,3}(?:[\s.,]\d{3})+|\d{3,6})\s*(?:til|to|-|–)\s*(\d{1,3}(?:[\s.,]\d{3})+|\d{3,6})\s*(?:t\/år|tonn\/år|t\/year|t\/yr|tonnes?\/year|tonn)\b/i,
    );
    if (rangeMatch?.[1] && rangeMatch?.[2]) {
      const low = parseNumberToken(rangeMatch[1]);
      const high = parseNumberToken(rangeMatch[2]);
      if (low && high) {
        wetTonnesPerYear = Math.round((low + high) / 2);
        wetTonnesRangeLabel = `${low.toLocaleString("en-US")}–${high.toLocaleString("en-US")} t/yr (midpoint ${wetTonnesPerYear.toLocaleString("en-US")} t/yr)`;
      }
    }
  }

  if (!wetTonnesPerYear) {
    const singleMatch = corpus.match(
      /\b(\d{1,3}(?:[\s.,]\d{3})+|\d{3,6})\s*(?:t\/år|tonn\/år|t\/year|t\/yr|tonnes?\/year)\b/i,
    );
    if (singleMatch?.[1]) {
      wetTonnesPerYear = parseNumberToken(singleMatch[1]);
    }
  }

  let inletMoistureFraction = ARCHETYPE_DEFAULTS[archetype].defaultInletMoisture;
  let moistureSource: "captured" | "baseline" = "baseline";

  if (typeof overrideMoisturePct === "number" && overrideMoisturePct >= 5 && overrideMoisturePct <= 85) {
    inletMoistureFraction = overrideMoisturePct / 100;
    moistureSource = "captured";
  } else {
    const dmMatch = corpus.match(/(?:tørrstoff|dry\s*matter|ts)\s*[:=]?\s*(\d{1,2})\s*%/i);
    const moistMatch = corpus.match(/(?:fukt(?:ighet)?|moisture)\s*[:=]?\s*(\d{1,2})\s*%/i);
    if (moistMatch?.[1]) {
      const pct = Number(moistMatch[1]);
      if (pct >= 5 && pct <= 85) {
        inletMoistureFraction = pct / 100;
        moistureSource = "captured";
      }
    } else if (dmMatch?.[1]) {
      const dmPct = Number(dmMatch[1]);
      if (dmPct >= 15 && dmPct <= 95) {
        inletMoistureFraction = (100 - dmPct) / 100;
        moistureSource = "captured";
      }
    }
  }

  if (!wetTonnesPerYear) {
    return {
      ready: false,
      archetype,
      missingReason:
        "No annual feedstock volume (t/yr) captured or proposed yet. Capture feedstock volume on Pillar 2 (or extract from correspondence) to compute dryer duty, net GWh/yr thermal heat, and biochar/CORC output.",
    };
  }

  return computeFelMassEnergyBalance({
    wetTonnesPerYear,
    wetTonnesRangeLabel,
    inletMoistureFraction,
    moistureSource,
    archetype,
  });
}
