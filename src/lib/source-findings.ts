import type { UnderstandingFieldId } from "@/types/opportunity-understanding";

export type SourceFindingDecision = "confirmed" | "dismissed";

export type SourceFindingClaim = {
  id: string;
  statement: string;
  impact: string;
  /** When confirmed, this writes the matching understanding field. */
  fieldId?: UnderstandingFieldId;
  decision?: SourceFindingDecision;
};

export type SourceFindingKind = "url" | "note" | "document" | "competitor";

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
      row.kind === "competitor"
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
    claims.push({ id, statement, impact, fieldId, decision });
  }
  return claims;
}

const UNDERSTANDING_FIELD_IDS: UnderstandingFieldId[] = [
  "decision_maker",
  "economic_buyer",
  "offtake_strategy",
  "budget",
  "timeline",
  "end_product",
  "capacity",
  "technical_fit",
  "feedstock_volume",
  "feedstock_quality",
  "business_case_strength",
  "funding_source",
  "utilities",
  "site_readiness",
  "permitting",
  "stakeholder_map",
];

function isUnderstandingField(value: string): value is UnderstandingFieldId {
  return UNDERSTANDING_FIELD_IDS.includes(value as UnderstandingFieldId);
}

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

export function appendSourceFinding(
  current: SourceFinding[] | undefined,
  finding: SourceFinding,
): SourceFinding[] {
  const existing = current ?? [];
  if (existing.some((row) => row.id === finding.id)) return existing;
  if (finding.kind === "competitor") {
    const index = existing.findIndex((row) => row.kind === "competitor");
    if (index >= 0) {
      const previous = existing[index];
      return existing.map((row, rowIndex) =>
        rowIndex === index ? mergeCompetitorFinding(previous, finding) : row,
      );
    }
  }
  if (
    finding.url &&
    existing.some((row) => row.url && row.url.toLowerCase() === finding.url!.toLowerCase())
  ) {
    return existing.map((row) =>
      row.url && row.url.toLowerCase() === finding.url!.toLowerCase() ? finding : row,
    );
  }
  if (
    finding.kind === "document" &&
    finding.note &&
    existing.some((row) => row.kind === "document" && row.note === finding.note)
  ) {
    return existing.map((row) =>
      row.kind === "document" && row.note === finding.note ? finding : row,
    );
  }
  return [...existing, finding];
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
): SourceFindingClaim {
  return { id, statement, impact, fieldId };
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

  if (/enova/i.test(text) || /innovasjon norge/i.test(text)) {
    const funders = [
      /enova/i.test(text) ? "Enova" : null,
      /innovasjon norge/i.test(text) ? "Innovasjon Norge" : null,
    ].filter(Boolean);
    claims.push(
      claim(
        "funding",
        `Public funding mentioned: ${funders.join(" and ")}.`,
        "Funding path determines timeline realism. Confirm what is granted vs applied.",
        "funding_source",
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

  if (/raudemel|volda kommune/i.test(text)) {
    claims.push(
      claim(
        "site",
        "The site is named in the source (Raudemel / Volda).",
        "Site identity and zoning are permitting evidence — not a blank.",
        "site_readiness",
      ),
    );
  } else if (/m[²2]|kvadratmeter|20[\s.]?000 m/i.test(text)) {
    claims.push(
      claim(
        "site",
        "The source describes plant buildings or tank volume on site.",
        "Site scale is a readiness signal — confirm before assuming installation windows.",
        "site_readiness",
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
