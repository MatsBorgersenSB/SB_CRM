import {
  isUnderstandingFieldId,
  type UnderstandingFieldId,
} from "@/types/opportunity-understanding";

export type SourceFindingDecision = "confirmed" | "dismissed";

export type SourceFindingClaim = {
  id: string;
  statement: string;
  impact: string;
  /** When confirmed, this writes the matching understanding field. */
  fieldId?: UnderstandingFieldId;
  /** Whether the extracted fact describes Standard Bio's plant or the host's existing facility. */
  plantScope?: "our_plant" | "host_plant";
  decision?: SourceFindingDecision;
};

export type SourceFindingKind =
  | "url"
  | "note"
  | "document"
  | "competitor"
  | "email"
  | "activity"
  | "image";

export type SourceFinding = {
  id: string;
  title: string;
  url?: string;
  note?: string;
  kind?: SourceFindingKind;
  addedAt: string;
  claims: SourceFindingClaim[];
};

export type SourceFindingPreview = {
  title: string;
  claims: SourceFindingClaim[];
};

const PRIVATE_HOST =
  /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0|\[::1\]|169\.254\.)/i;

export function isPublicHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    if (PRIVATE_HOST.test(parsed.hostname)) return false;
    if (parsed.hostname.endsWith(".local") || parsed.hostname.endsWith(".internal")) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function extractFirstUrl(raw: string): string | null {
  const match = raw.match(/https?:\/\/[^\s<>"']+/i);
  if (!match) return null;
  const candidate = match[0].replace(/[),.;]+$/, "");
  return isPublicHttpUrl(candidate) ? candidate : null;
}

export function parseSourceFindings(raw: unknown): SourceFinding[] {
  if (!Array.isArray(raw)) return [];
  const findings: SourceFinding[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const row = entry as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id.trim() : "";
    const title = typeof row.title === "string" ? row.title.trim() : "";
    if (!id || !title) continue;
    const url = typeof row.url === "string" && row.url.trim() ? row.url.trim() : undefined;
    const note = typeof row.note === "string" ? row.note.trim() : undefined;
    const kind: SourceFindingKind | undefined =
      row.kind === "url" ||
      row.kind === "note" ||
      row.kind === "document" ||
      row.kind === "competitor" ||
      row.kind === "email" ||
      row.kind === "activity" ||
      row.kind === "image"
        ? row.kind
        : undefined;
    const addedAt =
      typeof row.addedAt === "string" && row.addedAt.trim()
        ? row.addedAt
        : new Date().toISOString();
    findings.push({
      id,
      title,
      url,
      note: note || undefined,
      kind,
      addedAt,
      claims: parseClaims(row.claims),
    });
  }
  return findings;
}

function parseClaims(raw: unknown): SourceFindingClaim[] {
  if (!Array.isArray(raw)) return [];
  const claims: SourceFindingClaim[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const row = entry as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id.trim() : "";
    const statement = typeof row.statement === "string" ? row.statement.trim() : "";
    const impact = typeof row.impact === "string" ? row.impact.trim() : "";
    if (!id || !statement || !impact) continue;
    const fieldId =
      typeof row.fieldId === "string" && isUnderstandingField(row.fieldId)
        ? row.fieldId
        : undefined;
    const decision =
      row.decision === "confirmed" || row.decision === "dismissed"
        ? row.decision
        : undefined;
    const plantScope =
      row.plantScope === "our_plant" || row.plantScope === "host_plant"
        ? row.plantScope
        : undefined;
    claims.push({ id, statement, impact, fieldId, plantScope, decision });
  }
  return claims;
}

/** Single source of truth: the understanding model. */
const isUnderstandingField = isUnderstandingFieldId;

export function createSourceFinding(input: {
  title: string;
  url?: string;
  note?: string;
  kind?: SourceFindingKind;
  claims: SourceFindingClaim[];
}): SourceFinding {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? `finding-${crypto.randomUUID()}`
      : `finding-${Date.now()}`;
  return {
    id,
    title: input.title.trim() || "Finding",
    url: input.url,
    note: input.note?.trim() || undefined,
    kind: input.kind,
    addedAt: new Date().toISOString(),
    claims: input.claims.map((claim, index) => ({
      ...claim,
      id: claim.id || `${id}-claim-${index + 1}`,
    })),
  };
}

function normalizeFindingStatement(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Facts read from a URL or document are not knowledge until someone confirms them.
 * A fact this record already holds — a confirmed claim, or an understanding field
 * already answered — is not asked again.
 */
export function settleIncomingClaims(
  claims: SourceFindingClaim[],
  existing: SourceFinding[] | undefined,
  filledFieldIds?: readonly UnderstandingFieldId[],
  allowMultiplePerField = false,
): SourceFindingClaim[] {
  const filled = new Set(filledFieldIds ?? []);
  const confirmedStatements = new Set<string>();
  const dismissedStatements = new Set<string>();
  const confirmedFields = new Set<UnderstandingFieldId>();

  for (const finding of existing ?? []) {
    for (const claim of finding.claims) {
      const key = normalizeFindingStatement(claim.statement);
      if (!key) continue;
      if (claim.decision === "dismissed") dismissedStatements.add(key);
      if (claim.decision === "confirmed") {
        confirmedStatements.add(key);
        if (claim.fieldId) confirmedFields.add(claim.fieldId);
      }
    }
  }

  const seen = new Set<string>();
  const next: SourceFindingClaim[] = [];
  for (const claim of claims) {
    const key = normalizeFindingStatement(claim.statement);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    if (dismissedStatements.has(key) || confirmedStatements.has(key)) continue;
    if (
      !allowMultiplePerField &&
      claim.fieldId &&
      (filled.has(claim.fieldId) || confirmedFields.has(claim.fieldId))
    ) {
      continue;
    }
    next.push({
      id: claim.id,
      statement: claim.statement,
      impact: claim.impact,
      fieldId: claim.fieldId,
    });
  }
  return next;
}

/** Re-collect keeps confirmed competitor knowledge and does not revive dismissed ones. */
export function mergeCompetitorFinding(
  previous: SourceFinding,
  incoming: SourceFinding,
): SourceFinding {
  const confirmed = previous.claims.filter((row) => row.decision === "confirmed");
  const dismissed = new Set(
    previous.claims
      .filter((row) => row.decision === "dismissed")
      .map((row) => normalizeFindingStatement(row.statement)),
  );
  const confirmedKeys = new Set(
    confirmed.map((row) => normalizeFindingStatement(row.statement)),
  );
  const nextNew = incoming.claims.filter((row) => {
    const key = normalizeFindingStatement(row.statement);
    return !dismissed.has(key) && !confirmedKeys.has(key);
  });
  return {
    ...incoming,
    id: previous.id,
    addedAt: previous.addedAt,
    claims: [...confirmed, ...nextNew].slice(0, 7),
  };
}

/** Keep what a person already decided. Only unseen facts come back for validation. */
function mergeReadFinding(previous: SourceFinding, incoming: SourceFinding): SourceFinding {
  const decided = previous.claims.filter(
    (row) => row.decision === "confirmed" || row.decision === "dismissed",
  );
  const decidedKeys = new Set(decided.map((row) => normalizeFindingStatement(row.statement)));
  const confirmedFields = new Set(
    decided
      .filter((row) => row.decision === "confirmed" && row.fieldId)
      .map((row) => row.fieldId as UnderstandingFieldId),
  );
  const fresh = incoming.claims.filter((row) => {
    const key = normalizeFindingStatement(row.statement);
    if (!key || decidedKeys.has(key)) return false;
    if (row.fieldId && confirmedFields.has(row.fieldId)) return false;
    return true;
  });
  return {
    ...previous,
    title: incoming.title.trim() || previous.title,
    url: incoming.url ?? previous.url,
    note: incoming.note ?? previous.note,
    kind: incoming.kind ?? previous.kind,
    claims: [...decided, ...fresh],
  };
}

export function appendSourceFinding(
  current: SourceFinding[] | undefined,
  finding: SourceFinding,
  filledFieldIds?: readonly UnderstandingFieldId[],
): SourceFinding[] {
  const existing = current ?? [];
  const isEvidenceRecord =
    finding.kind === "document" ||
    finding.kind === "image" ||
    finding.kind === "email" ||
    finding.kind === "activity";
  const incoming: SourceFinding =
    finding.kind === "competitor"
      ? finding
      : {
          ...finding,
          claims: settleIncomingClaims(
            finding.claims,
            existing,
            // Evidence from documents, pictures, client/subsupplier/internal mail, and activities
            // must flow into the opportunity/project even when a field already has a rough note.
            isEvidenceRecord ? undefined : filledFieldIds,
            isEvidenceRecord,
          ),
        };

  if (existing.some((row) => row.id === incoming.id)) return existing;
  if (incoming.kind === "competitor") {
    const index = existing.findIndex((row) => row.kind === "competitor");
    if (index >= 0) {
      const previous = existing[index];
      return existing.map((row, rowIndex) =>
        rowIndex === index ? mergeCompetitorFinding(previous, incoming) : row,
      );
    }
  }
  if (isEvidenceRecord && incoming.note) {
    if (existing.some((row) => row.kind === incoming.kind && row.note === incoming.note)) {
      return existing.map((row) =>
        row.kind === incoming.kind && row.note === incoming.note
          ? mergeReadFinding(row, incoming)
          : row,
      );
    }
    if (incoming.claims.length === 0) return existing;
    return [...existing, incoming];
  }
  if (
    incoming.url &&
    existing.some((row) => row.url && row.url.toLowerCase() === incoming.url!.toLowerCase())
  ) {
    return existing.map((row) =>
      row.url && row.url.toLowerCase() === incoming.url!.toLowerCase()
        ? mergeReadFinding(row, incoming)
        : row,
    );
  }
  return [...existing, incoming];
}

export function applySourceFindingDecision(
  current: SourceFinding[] | undefined,
  findingId: string,
  claimId: string,
  decision: SourceFindingDecision,
): SourceFinding[] {
  return (current ?? []).map((finding) => {
    if (finding.id !== findingId) return finding;
    return {
      ...finding,
      claims: finding.claims.map((claim) =>
        claim.id === claimId ? { ...claim, decision } : claim,
      ),
    };
  });
}

export function applySourceFindingConfirmAll(
  current: SourceFinding[] | undefined,
  findingId: string,
): SourceFinding[] {
  return (current ?? []).map((finding) => {
    if (finding.id !== findingId) return finding;
    return {
      ...finding,
      claims: finding.claims.map((claim) =>
        claim.decision === "dismissed" ? claim : { ...claim, decision: "confirmed" },
      ),
    };
  });
}

export function confirmedFindingAnswerForField(
  findings: SourceFinding[] | undefined,
  fieldId: UnderstandingFieldId,
): string | null {
  for (const finding of findings ?? []) {
    for (const claim of finding.claims) {
      if (claim.fieldId !== fieldId || claim.decision !== "confirmed") continue;
      const source = finding.url ? ` (from ${finding.title})` : "";
      return `${claim.statement}${source}`;
    }
  }
  return null;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

export function htmlToPlainText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

export function extractPageTitle(html: string, url: string): string {
  const og =
    html.match(
      /<meta[^>]+(?:property|name)=["']og:title["'][^>]*content=["']([^"']+)/i,
    ) ??
    html.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']og:title["']/i,
    );
  if (og?.[1]) return decodeEntities(og[1]).trim().slice(0, 160);

  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1?.[1]) {
    const text = htmlToPlainText(h1[1]).trim();
    if (text) return text.slice(0, 160);
  }

  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title?.[1]) {
    const text = htmlToPlainText(title[1]).trim();
    if (text) return text.slice(0, 160);
  }

  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Public source";
  }
}

function claim(
  id: string,
  statement: string,
  impact: string,
  fieldId?: UnderstandingFieldId,
  plantScope?: "our_plant" | "host_plant",
): SourceFindingClaim {
  return { id, statement, impact, fieldId, ...(plantScope ? { plantScope } : {}) };
}

function uniqueClaims(claims: SourceFindingClaim[]): SourceFindingClaim[] {
  const seen = new Set<string>();
  const next: SourceFindingClaim[] = [];
  for (const row of claims) {
    const key = row.statement.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(row);
  }
  return next.slice(0, 10);
}

/**
 * Deterministic claims from public-page text. Never invents people or companies
 * as CRM records — only proposed facts the user can confirm.
 */
export function extractSourceFindingPreview(
  htmlOrText: string,
  url: string,
  titleOverride?: string,
): SourceFindingPreview {
  const title = titleOverride?.trim() || extractPageTitle(htmlOrText, url);
  const text = htmlToPlainText(htmlOrText);
  const lower = text.toLowerCase();
  const claims: SourceFindingClaim[] = [];
  const permitish =
    /tillatelse|forurensningsloven|statsforvalteren|utslippstillatelse|environmental permit/i.test(
      text,
    );

  const permitNo =
    text.match(/Tillatelsesnummer[:\s]*([0-9]{4}\.[0-9]{4}\.T)/i)?.[1] ??
    text.match(/\b(20\d{2}\.\d{4}\.T)\b/)?.[1];
  const lastChanged =
    text.match(/Tillatelse sist endret[:\s]*(\d{2}\.\d{2}\.\d{4})/i)?.[1];
  const firstGiven =
    text.match(/Tillatelse første gang gitt[:\s]*(\d{2}\.\d{2}\.\d{4})/i)?.[1];
  if (permitNo || permitish) {
    const parts = [
      permitNo ? `Permit ${permitNo}` : "An environmental permit",
      lastChanged ? `last changed ${lastChanged}` : null,
      firstGiven ? `first granted ${firstGiven}` : null,
    ].filter(Boolean);
    claims.push(
      claim(
        "permitting",
        `${parts.join(", ")}. This is authority evidence, not an assumption.`,
        "Whether the plant can legally operate is already documented. Confirm it onto the record.",
        "permitting",
      ),
    );
  }

  const volumes = [
    ...text.matchAll(
      /(\d{1,3}(?:[.\s]\d{3})+|\d{4,7})\s*(?:tonn|t\/year|t per year|tonnes?\/year)/gi,
    ),
  ];
  if (volumes.length > 0) {
    const listed = [...new Set(volumes.map((match) => match[0].replace(/\s+/g, " ").trim()))];
    claims.push(
      claim(
        "feedstock-volume",
        `Reported plant volume: ${listed.slice(0, 3).join("; ")}.`,
        "Volume is the design driver. Confirm before proposing a turnkey package.",
        "feedstock_volume",
      ),
    );
  }

  const qualityBits: string[] = [];
  if (/husdyrgjødsel|manure/i.test(text)) qualityBits.push("manure");
  if (/akvakultur|aquaculture|fiskeslam|fish sludge/i.test(text)) {
    qualityBits.push("aquaculture sludge");
  }
  if (/fiskeensilasje|fish ensilage|ensilage/i.test(text)) qualityBits.push("fish ensilage");
  if (/matavfall|food waste/i.test(text)) qualityBits.push("food waste");
  if (qualityBits.length > 0) {
    claims.push(
      claim(
        "feedstock-quality",
        `Reported feedstock mix: ${qualityBits.join(", ")}.`,
        "Quality and mix change process design and offtake specs.",
        "feedstock_quality",
      ),
    );
  }

  const capex = text.match(
    /(\d{2,4})\s*(?:millioner|mill\.?)\s*(?:kroner|nok)|(\d{2,4})\s*mnok/i,
  );
  if (capex) {
    const amount = capex[1] || capex[2];
    claims.push(
      claim(
        "budget",
        `Reported project value around ${amount} million NOK.`,
        "Investment size tells us whether this is a study, a plant, or something else.",
        "budget",
      ),
    );
  }

  if (/enova/i.test(text) || /innovasjon norge|innovation norway|skattefunn/i.test(text)) {
    const funders = [
      /enova/i.test(text) ? "Enova" : null,
      /innovasjon norge|innovation norway/i.test(text) ? "Innovasjon Norge" : null,
      /skattefunn/i.test(text) ? "Skattefunn" : null,
    ].filter(Boolean);
    const schemeList = funders.join(" and ");
    claims.push(
      claim(
        "funding",
        `Public funding mentioned: ${schemeList}.`,
        "Funding path determines timeline realism. Confirm what is granted vs applied.",
        "funding_source",
      ),
    );
    claims.push(
      claim(
        "public-funding-pillar",
        `Public subsidy scheme identified on record: ${schemeList}${/søknad|apply|applied|kvalifiserer|qualif/i.test(text) ? " (application / qualification noted)" : ""}.`,
        "Securing public subsidies reduces Standard Bio equity exposure before financial close.",
        "public_funding",
        "our_plant",
      ),
    );
  }

  // Separate pyrolysis / dryer permit pathway for Standard Bio's plant (Pillar 7: our_plant)
  if (
    /separat\s+tillatelse|separate\s+permit|egen\s+(?:utslipps)?tillatelse|pyrolysis\s+permit|pyrolyse.*tillatelse|tillatelse.*pyrolyse|ny\s+tørke.*tillatelse/i.test(
      text,
    )
  ) {
    claims.push(
      claim(
        "pyrolysis-permitting",
        "Separate environmental/building permit pathway identified for the Standard Bio pyrolysis and dryer installation.",
        "Our pyrolysis plant requires its own permit clearance distinct from the host biogas permit.",
        "permitting",
        "our_plant",
      ),
    );
  }

  if (
    !permitNo &&
    /miljøgodkj|environmental approval|tillatelse|utslippstillatelse|permit/i.test(
      text,
    )
  ) {
    claims.push(
      claim(
        "permitting",
        "The source reports an environmental approval or permit pathway.",
        "Permitting is often the real critical path. Confirm status and limits.",
        "permitting",
      ),
    );
  }

  const products: string[] = [];
  if (/\blbg\b|flytende biometan|liquefied biogas/i.test(text)) products.push("LBG");
  if (/\blco2\b|flytende karbondioksid/i.test(text)) products.push("LCO2");
  if (/biogjødsel|digestate|biorest/i.test(text)) products.push("digestate");
  if (products.length > 0) {
    claims.push(
      claim(
        "end-product",
        `Reported outputs: ${products.join(", ")}.`,
        "Product intent drives system design, offtake, and what we should sell.",
        "end_product",
      ),
    );
  }

  const plotDimMatch = text.match(/\b(\d{2,3}\s*[x×]\s*\d{2,3}\s*m(?:[²2]|\b))/i);
  if (/raudemel|volda kommune/i.test(text)) {
    claims.push(
      claim(
        "site",
        "The site is named in the source (Raudemel / Volda).",
        "Site identity and zoning are permitting evidence — not a blank.",
        "site_readiness",
        "host_plant",
      ),
    );
  } else if (!plotDimMatch && /m[²2]|kvadratmeter|20[\s.]?000 m/i.test(text)) {
    claims.push(
      claim(
        "site",
        "The source describes plant buildings or tank volume on site.",
        "Site scale is a readiness signal — confirm before assuming installation windows.",
        "site_readiness",
        "host_plant",
      ),
    );
  }

  if (/ikke ha utslipp til vann|ingen ordinære utslipp til vann/i.test(text)) {
    claims.push(
      claim(
        "utilities",
        "The permit requires a closed process with no ordinary discharge to water.",
        "Site utilities and discharge limits change what can be promised in a package.",
        "utilities",
      ),
    );
  }

  if (/1\s*oue\/m/i.test(text)) {
    claims.push(
      claim(
        "technical-odor",
        "Odour at neighbouring homes is capped at 1 ouE/m³.",
        "Odour limits are a real operating constraint, not a neighbour complaint to ignore.",
        "technical_fit",
      ),
    );
  }

  if (/plugflow|plug-flow|cstr/i.test(text)) {
    claims.push(
      claim(
        "technical-fit",
        "The source describes process technology (plug-flow / CSTR comparison).",
        "Technical design must match the process they are actually building.",
        "technical_fit",
      ),
    );
  }

  if (/\blbg\b|flytende biogass|liquefied biogas|gassen er allerede solgt|gas already sold/i.test(text)) {
    claims.push(
      claim(
        "offtake",
        "The source indicates gas offtake or an LBG path.",
        "Offtake is what makes the plant commercially real.",
        "offtake_strategy",
      ),
    );
  }

  const year = text.match(/(?:salg|sales|oppstart|start-up|first sales).{0,40}(20\d{2})/i);
  if (
    !permitish &&
    (year?.[1] || /høsten 20\d{2}|late 20\d{2}|q[1-4] 20\d{2}/i.test(text))
  ) {
    const when = year?.[1] ? year[1] : "the date named in the article";
    claims.push(
      claim(
        "timeline",
        `Reported start of sales / operations around ${when}.`,
        "Timeline tells us whether we are early, on time, or late to the package.",
        "timeline",
      ),
    );
  }

  if (/eier|owner|95\s*%|95 prosent/i.test(lower) && /antec/i.test(lower)) {
    claims.push(
      claim(
        "ownership",
        "The source describes Antec ownership of the plant / operating company.",
        "Treat the operator as an affiliate, not a new customer, until you classify the relationship.",
      ),
    );
  }

  // Throughput / design capacity (kg/h, t/h, GWh/yr, MW, kW)
  const capacityMatch = text.match(
    /\b(\d[\d\s.,]*\s*(?:kg\/h|t\/h|tonn\/t|tonn\/time|t\/d|tonn\/dag|nm3\/h|m3\/h|m³\/h|gwh(?:\s*\/\s*(?:år|year|yr))?|mwh(?:\s*\/\s*(?:år|year|yr))?|mw\b|kw\b))/i,
  );
  if (capacityMatch?.[1]) {
    claims.push(
      claim(
        "capacity",
        `Reported throughput or thermal capacity: ${capacityMatch[1].replace(/\s+/g, " ").trim()}.`,
        "Capacity drives reactor sizing, heat integration, and commercial scope.",
        "capacity",
      ),
    );
  }

  // Subsupplier / feedstock supply terms (e.g. Allskog G30 wood chips)
  if (/\ballskog\b|\bg30\b|\btreflis\b|\bwood\s*chips\b|\btørket\s+flis\b/i.test(text)) {
    const volMatch = text.match(
      /(\d[\d\s.,]*(?:til|-|–)\s*\d[\d\s.,]*\s*(?:t\/år|tonn\/år|t\/year|tonn)|\d[\d\s.,]*\s*(?:t\/år|tonn\/år|t\/year))\b/i,
    );
    const dsMatch = text.match(/tørrstoff\s*(\d{1,2}\s*%)/i)?.[1];
    const details: string[] = [];
    if (dsMatch) details.push(`target dry matter ${dsMatch.replace(/\s+/g, "")}`);
    if (/fukt\s*%|moisture/i.test(text)) {
      details.push("supplier requested moisture % specification and monthly storage/consumption capacity");
    }
    if (/ingen\s+lokal\s+flishugger|sidetipp\s+eller\s+baktipp/i.test(text)) {
      details.push("no local chipper in area; truck access (side/rear tip) and storage layout must be specified");
    }
    const detailSuffix = details.length > 0 ? ` (${details.join("; ")})` : "";
    claims.push(
      claim(
        "feedstock-agreement",
        `Feedstock supply dialogue on record${volMatch?.[1] ? `: ${volMatch[1].replace(/\s+/g, " ").trim()} G30 wood chips` : " (wood chips / treflis)"}${detailSuffix}.`,
        "Committed feedstock supply, moisture limits, and on-site storage/delivery access are prerequisites for plant operation.",
        "feedstock_agreement",
      ),
    );
  }

  // Biochar product offtake (e.g. TerraMarine activated biochar / biokull)
  if (
    /terramarine|aktivert\s+biokull|activated\s+biochar|høy-kvalitet\s+biokull\s+produksjon|biochar\s+offtake/i.test(
      text,
    )
  ) {
    const isTerraMarine = /terramarine/i.test(text);
    claims.push(
      claim(
        "biochar-offtake",
        isTerraMarine
          ? "Biochar product offtake dialogue initiated with TerraMarine regarding interest and quality requirements for activated biochar."
          : "High-quality biochar production identified as core plant output requiring product offtake and specification alignment.",
        "Securing biochar product offtake and quality specifications is a core revenue pillar for project realisation.",
        "end_product",
      ),
    );
  }

  // Energy / thermal heat offtake (e.g. surplus energy sold to Antec / Vest Biogass for drying)
  if (
    /overskuddsenergi(?:en)?\s+selges|tørking\s+av\s+bioresten|strategisk\s+energiløsning|7\s*[-–]\s*8\s*gwh/i.test(
      text,
    )
  ) {
    claims.push(
      claim(
        "energy-offtake",
        "Surplus thermal energy from the wood-chip pyrolysis plant is planned sold to the adjacent biogas plant for digestate drying.",
        "Securing the thermal energy offtake agreement (volume, tariff, and term) anchors local project heat revenue.",
        "offtake_strategy",
      ),
    );
  }

  // Multi-line pyrolysis / internal engineering layout notes
  if (/to\s+pyrolyse\s+linjer|2\s+biokull\s+linje|enkel\s+flow\s+på\s+to\s+pyrolyse/i.test(text)) {
    claims.push(
      claim(
        "technical-two-lines",
        "Internal engineering evaluation covers two pyrolysis lines integrated with the biogas plant mass/energy flow.",
        "Defines the number of reactor lines and thermal/mass integration basis for FEL engineering.",
        "technical_fit",
      ),
    );
  }

  // Customer problem (digestate / biorest / Gjødselforskriften / disposal cost)
  if (
    /gjødselforskriften|gjødsel\s*forskriften|biorest\s*utfordring|løsning\s+på\s+bioresten|løsning\s+på\s+fastfraksjonen|disposal\s+of\s+aggregated\s+digestate/i.test(
      text,
    )
  ) {
    claims.push(
      claim(
        "customer-problem",
        "Customer needs a solution for solid digestate / biorest disposal driven by nutrient spreading limits.",
        "Confirms the core customer problem driving both drying heat demand and pyrolysis interest.",
        "customer_problem",
      ),
    );
  }

  // Site space confirmation from client / site visit (including quantitative plot dimensions)
  if (
    !claims.some((c) => c.fieldId === "site_readiness" && c.plantScope === "our_plant") &&
    (plotDimMatch ||
      /nok\s+plass\s+på\s+anlegget|footprint\s+approved|equipment\s+footprint|festekontrakt|leieavtale\s+for\s+tomt/i.test(
        text,
      ))
  ) {
    const dimLabel = plotDimMatch?.[1] ? ` (${plotDimMatch[1].replace(/\s+/g, " ").trim()})` : "";
    claims.push(
      claim(
        "site-space",
        `Client confirmed sufficient plot space${dimLabel} at the biogas plant for a pyrolysis installation.`,
        "Site availability unblocks layout engineering and permitting.",
        "site_readiness",
        "our_plant",
      ),
    );
  }

  // Thermal energy / utility integration (quantitative kW / MW / GWh / tie-in ducts)
  const powerTieInMatch = text.match(/\b(\d{2,4}\s*kw|\d+(?:[.,]\d+)?\s*mw)\b/i);
  if (
    !claims.some((c) => c.fieldId === "utilities" && c.plantScope === "our_plant") &&
    (/overskuddsenergi|7\s*[-–]\s*8\s*gwh|thermal\s+heat\s+exchange|utility\s+capacity|rørgate|tie-?in|varmeveksler/i.test(
      text,
    ))
  ) {
    const powerNote = powerTieInMatch?.[1] ? ` (${powerTieInMatch[1].trim()} electrical/thermal interface noted)` : "";
    claims.push(
      claim(
        "utilities-heat",
        `Surplus thermal energy integration and utility tie-ins between pyrolysis and digestate drying are part of the scope${powerNote}.`,
        "Heat tie-in and utility capacity define the technical interface with the client plant.",
        "utilities",
        "our_plant",
      ),
    );
  }

  // Mass flow / block flow / technical process
  if (
    !claims.some((c) => c.fieldId === "technical_fit") &&
    (/masseflyt|blokkflyt|flow\s*diagram|flytdiagram|back-of-the-envelope|fraksjon\s*\(?a\)?/i.test(
      text,
    ))
  ) {
    claims.push(
      claim(
        "technical-flow",
        "Mass / block flow and process line integration (Fraction A / Line B / wood chips) documented.",
        "Grounds technical fit and mass-balance engineering in customer-provided figures.",
        "technical_fit",
      ),
    );
  }

  // Customer vision / BOO ownership appetite
  if (
    /investering\s+og\s+drifting\s+av\s+pyrolyse|establish(?:ing)?\s+a\s+pyrolysis\s+plant\s+in\s+direct\s+proximity/i.test(
      text,
    )
  ) {
    claims.push(
      claim(
        "customer-vision",
        "Client envisions Standard Bio investing in and operating the pyrolysis line adjacent to the biogas plant and selling the biochar.",
        "Clarifies the desired commercial model (Build-Own-Operate) and division of responsibility.",
        "customer_vision",
      ),
    );
  }

  const unique = uniqueClaims(claims);
  if (unique.length === 0) {
    const snippet = text.slice(0, 220).trim();
    unique.push(
      claim(
        "attached",
        snippet
          ? `Source attached. Opening line: “${snippet}${text.length > 220 ? "…" : ""}”`
          : "Source attached. SmartAssist could not extract structured facts — add what you learned in the box.",
        "A linked source is only useful once someone confirms what it means for this record.",
      ),
    );
  }

  return { title: title || "Public source", claims: unique };
}

/**
 * Extract structured knowledge claims from a filed document or picture's identity,
 * classification, origin (client / subsupplier / Standard Bio), and counterparty.
 * Ensures drawings, flow diagrams, presentations, permits, subsupplier quotes, and
 * pictures always flow into opportunity knowledge even when scanned or SharePoint-hosted.
 */
export function extractDocumentMetadataClaims(input: {
  name: string;
  mimeType?: string | null;
  docCategory?: string | null;
  docType?: string | null;
  origin?: string | null;
  counterparty?: string | null;
}): SourceFindingClaim[] {
  const name = input.name.trim();
  const cleanTitle = name.replace(/\.[^.]+$/, "").replace(/^(?:PL|CO|PRJ)-[A-Z0-9]+(?:-[A-Z0-9]+)*-[A-Z]-[A-Z]{2,4}-\d{4}\s*/i, "").trim() || name;
  const lower = `${name} ${input.docCategory ?? ""} ${input.docType ?? ""}`.toLowerCase();
  const counterparty = input.counterparty?.trim();
  const fromWho = counterparty
    ? ` from ${counterparty}`
    : input.origin === "external"
      ? " (external / subsupplier or authority)"
      : "";
  const claims: SourceFindingClaim[] = [];

  if (/tillatelse|permit|utslipp|forurensning|konsesjon|certificate|miljøgodkj/i.test(lower)) {
    const refNo = cleanTitle.match(/\b(\d{5,8})\b/)?.[1];
    claims.push(
      claim(
        "doc-permitting",
        `Permit / certificate filed on record: “${cleanTitle}”${refNo ? ` (ref. ${refNo})` : ""}${fromWho}.`,
        "Provides regulatory and permitting evidence for plant approval and operating limits.",
        "permitting",
      ),
    );
  }

  if (/flow\s*diagram|flytdiagram|prosessflyt|process\s*flow|p&id|pnid|drawing|tegning|layout/i.test(lower)) {
    claims.push(
      claim(
        "doc-technical-fit",
        `Engineering drawing / process flow diagram on file: “${cleanTitle}”${fromWho}.`,
        "Defines process flow, equipment interfaces, and technical fit for the plant.",
        "technical_fit",
      ),
    );
  }

  if (/flow\s*hjelpefil|hjelpefil|calculation|beregning|heat\s*balance|massebalanse|mass\s*balance|kapasitet/i.test(lower)) {
    claims.push(
      claim(
        "doc-capacity",
        `Process flow / capacity calculation file on record: “${cleanTitle}”${fromWho}.`,
        "Supports throughput sizing, mass/energy balance, and reactor capacity validation.",
        "capacity",
      ),
    );
  }

  if (/presentasjon|presentation|strategisk|pitch|slide/i.test(lower)) {
    claims.push(
      claim(
        "doc-vision",
        `Strategic presentation on file: “${cleanTitle}”${fromWho}.`,
        "Captures the project concept, target outcome, and commercial positioning.",
        "customer_vision",
      ),
    );
  }

  if (/tilbud|quote|quotation|rfq|pris|price|invoice|faktura|ordrebekreftelse|order\s*confirm/i.test(lower)) {
    claims.push(
      claim(
        "doc-budget",
        `Commercial quote / pricing document on file: “${cleanTitle}”${fromWho}.`,
        "Grounds CAPEX, subsupplier pricing, or commercial scope in a filed document.",
        "budget",
      ),
    );
  }

  if (/datasheet|data\s*sheet|spesifikasjon|specification|kravspesifikasjon|io[-\s]?link|scada|plc/i.test(lower)) {
    claims.push(
      claim(
        "doc-spec",
        `Technical specification / datasheet on file: “${cleanTitle}”${fromWho}.`,
        "Documents technical requirements, subsupplier equipment interfaces, or control specs.",
        "technical_fit",
      ),
    );
  }

  const isImage =
    (input.mimeType ?? "").toLowerCase().startsWith("image/") ||
    /\.(png|jpe?g|webp|gif|bmp|tiff?|svg)$/i.test(name);
  if (isImage && claims.length === 0) {
    const isTechnical = /reactor|silo|io[-\s]?link|scada|plc|flow|diagram|tegning|skjermbilde/i.test(lower);
    claims.push(
      claim(
        isTechnical ? "img-technical" : "img-site",
        `Visual evidence / picture on file: “${cleanTitle}”${fromWho}.`,
        isTechnical
          ? "Visual documentation of equipment, control interface, or process layout."
          : "Visual site or equipment photo supporting site readiness and installation planning.",
        isTechnical ? "technical_fit" : "site_readiness",
      ),
    );
  }

  if (claims.length === 0) {
    claims.push(
      claim(
        "doc-filed",
        `Document filed on opportunity: “${cleanTitle}”${fromWho}.`,
        "Filed documentation is tracked as project evidence — confirm how it informs the deal.",
        "technical_fit",
      ),
    );
  }

  return uniqueClaims(claims);
}

export function previewFromNote(note: string): SourceFindingPreview {
  const text = note.trim();
  return {
    title: text.slice(0, 80) || "Note from you",
    claims: [
      claim(
        "note",
        text,
        "You added this. Confirm it onto the record if it should change what we know.",
      ),
    ],
  };
}
