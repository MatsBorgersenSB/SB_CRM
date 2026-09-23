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

export type SourceFinding = {
  id: string;
  title: string;
  url?: string;
  note?: string;
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
    const url =
      typeof row.url === "string" && isPublicHttpUrl(row.url) ? row.url.trim() : undefined;
    const note = typeof row.note === "string" ? row.note.trim() : undefined;
    const addedAt =
      typeof row.addedAt === "string" && row.addedAt.trim()
        ? row.addedAt
        : new Date().toISOString();
    findings.push({
      id,
      title,
      url,
      note: note || undefined,
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
    addedAt: new Date().toISOString(),
    claims: input.claims.map((claim, index) => ({
      ...claim,
      id: claim.id || `${id}-claim-${index + 1}`,
    })),
  };
}

export function appendSourceFinding(
  current: SourceFinding[] | undefined,
  finding: SourceFinding,
): SourceFinding[] {
  const existing = current ?? [];
  if (existing.some((row) => row.id === finding.id)) return existing;
  if (
    finding.url &&
    existing.some((row) => row.url && row.url.toLowerCase() === finding.url!.toLowerCase())
  ) {
    return existing.map((row) =>
      row.url && row.url.toLowerCase() === finding.url!.toLowerCase() ? finding : row,
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
  return next.slice(0, 8);
}

/**
 * Deterministic claims from public-page text. Never invents people or companies
 * as CRM records — only proposed facts the user can confirm.
 */
export function extractSourceFindingPreview(
  htmlOrText: string,
  url: string,
): SourceFindingPreview {
  const title = extractPageTitle(htmlOrText, url);
  const text = htmlToPlainText(htmlOrText);
  const lower = text.toLowerCase();
  const claims: SourceFindingClaim[] = [];

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

  const year = text.match(/(?:salg|sales|drift|operation|online).{0,40}(20\d{2})/i);
  if (year?.[1] || /høsten 20\d{2}|late 20\d{2}|q[1-4] 20\d{2}/i.test(text)) {
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

  if (/m[²2]|kvadratmeter|20[\s.]?000 m/i.test(text)) {
    claims.push(
      claim(
        "site",
        "The source describes plant buildings or tank volume on site.",
        "Site scale is a readiness signal — confirm before assuming installation windows.",
        "site_readiness",
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
