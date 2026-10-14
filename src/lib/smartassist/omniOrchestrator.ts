import type { GraphSearchResultItem } from "@/lib/smartassist/graphSearch";

export type DataFreshness = "FRESH" | "AGING" | "OUTDATED" | "EXTERNAL_ONLY";
export type EvidenceStatus = "FRESH" | "OUTDATED";

export type InternalEvidence = {
  title: string;
  timestamp: string;
  status: EvidenceStatus;
  snippet: string;
  webUrl?: string;
};

export type SourcingSuggestion = {
  name: string;
  category: string;
  region: string;
  reasoning: string;
};

export type SmartAssistActionType =
  | "CREATE_LEADS_AND_CALLS"
  | "DRAFT_REVALIDATION_EMAIL"
  | "REVIEW_DOC";

export type SmartAssistResolution = {
  summary: string;
  dataFreshness: DataFreshness;
  temporalNote?: string;
  internalEvidence: InternalEvidence[];
  sourcingSuggestions: SourcingSuggestion[];
  suggestedNextAction: {
    type: SmartAssistActionType;
    label: string;
    payload: Record<string, unknown>;
  };
};

export type TaskContextInput = {
  taskDescription: string;
  dateLimit?: string;
  internalHits: GraphSearchResultItem[];
};

const FRESH_MONTHS = 6;
const OUTDATED_MONTHS = 12;

const SYSTEM_PROMPT = `You are the high-CAPEX pyrolysis and torrefaction CRM copilot for Standard Bio.
Today's date is provided as "now". Judge every internal hit against that date.

Temporal rule: pricing, feedstock quotes, and market availability older than 6 months are suspect. Older than 12 months are outdated. Say so in temporalNote. Do not treat old quotes as current prices.

Sourcing rule: if the task is about procuring biomass or feedstock (wood chips, G30, sludge, pellets, bark, sawdust) in a region, and internal hits are missing or not fresh, name 2 or 3 real public suppliers, forestry hubs, or regional partners. Do not invent a legal entity, a person, an organisation number, or a price. If you are not sure a name exists, omit it.

Return only JSON with this shape:
{
  "summary": string,
  "temporalNote": string,
  "sourcingSuggestions": [{ "name": string, "category": string, "region": string, "reasoning": string }]
}
Write summary, temporalNote, and reasoning in Norwegian. Keep sourcingSuggestions to at most 3 items.`;

export function ageInMonths(timestamp: string, now: Date): number | null {
  const then = new Date(timestamp);
  if (Number.isNaN(then.getTime())) return null;
  let months = (now.getFullYear() - then.getFullYear()) * 12 + (now.getMonth() - then.getMonth());
  if (now.getDate() < then.getDate()) months -= 1;
  return months;
}

export function isProcurementTask(taskDescription: string): boolean {
  return /feedstock|biomass|biomasse|råstoff|raastoff|wood\s*chip|flis|g30|sludge|slam|pellet|tømmer|tommer|timber|bark|sawdust|sagflis|biorest/i.test(
    taskDescription,
  );
}

export function extractCommodity(taskDescription: string): string | null {
  if (/g30/i.test(taskDescription)) return "G30-flis";
  if (/wood\s*chip|flis/i.test(taskDescription)) return "flis";
  if (/sludge|slam/i.test(taskDescription)) return "slam";
  if (/pellet/i.test(taskDescription)) return "pellets";
  if (/bark|sawdust|sagflis/i.test(taskDescription)) return "bark og sagflis";
  if (isProcurementTask(taskDescription)) return "biomasse";
  return null;
}

export function extractRegion(taskDescription: string): string | null {
  const named = taskDescription.match(
    /\b(?:in|i|fra|near|ved)\s+([A-ZÆØÅ][\p{L}'-]{2,})/u,
  );
  if (named?.[1]) return named[1];
  const known = taskDescription.match(
    /\b(Norge|Norway|Sverige|Sweden|Finland|Danmark|Denmark|Tyskland|Germany|Polen|Poland|Innlandet|Viken|Oslo|Trøndelag|Trondelag|Vestland|Nordland|Telemark|Agder|Rogaland)\b/i,
  );
  return known?.[1] ?? null;
}

function evidenceFromHits(hits: GraphSearchResultItem[], now: Date): InternalEvidence[] {
  return hits.slice(0, 5).map((hit) => {
    const age = ageInMonths(hit.timestamp, now);
    const status: EvidenceStatus = age != null && age < FRESH_MONTHS ? "FRESH" : "OUTDATED";
    return {
      title: hit.title,
      timestamp: hit.timestamp,
      status,
      snippet: hit.snippet,
      ...(hit.webUrl ? { webUrl: hit.webUrl } : {}),
    };
  });
}

function overallFreshness(evidence: InternalEvidence[], now: Date): DataFreshness {
  if (evidence.length === 0) return "EXTERNAL_ONLY";
  const ages = evidence
    .map((item) => ageInMonths(item.timestamp, now))
    .filter((age): age is number => age != null);
  if (ages.length === 0) return "EXTERNAL_ONLY";
  const newest = Math.min(...ages);
  if (newest >= OUTDATED_MONTHS) return "OUTDATED";
  if (newest >= FRESH_MONTHS) return "AGING";
  return "FRESH";
}

function temporalNoteFor(freshness: DataFreshness, evidence: InternalEvidence[]): string | undefined {
  const outdated = evidence.filter((item) => item.status === "OUTDATED").length;
  if (freshness === "OUTDATED") {
    return "Intern dokumentasjon er eldre enn 12 måneder. Pris og tilgjengelighet er utdatert og må revalideres.";
  }
  if (freshness === "AGING") {
    return "Nyeste interne spor er mellom 6 og 12 måneder. Pris, råstofftilbud og tilgjengelighet er usikre.";
  }
  if (freshness === "FRESH" && outdated > 0) {
    return `${outdated} eldre treff er markert utdatert. Bruk bare det som er under 6 måneder.`;
  }
  if (freshness === "EXTERNAL_ONLY") {
    return "Ingen interne treff å datere. Ikke anta pris eller volum.";
  }
  return undefined;
}

function readSuggestions(draft: unknown, regionFallback: string | null): SourcingSuggestion[] {
  if (!draft || typeof draft !== "object") return [];
  const rows = (draft as { sourcingSuggestions?: unknown }).sourcingSuggestions;
  if (!Array.isArray(rows)) return [];
  const suggestions: SourcingSuggestion[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name.trim() : "";
    const category = typeof record.category === "string" ? record.category.trim() : "";
    const region = typeof record.region === "string" ? record.region.trim() : "";
    const reasoning = typeof record.reasoning === "string" ? record.reasoning.trim() : "";
    if (name.length < 2 || /^(unknown|ukjent|n\/a|tbd|supplier\s*\d+)$/i.test(name)) continue;
    if (!category || !reasoning) continue;
    suggestions.push({
      name,
      category,
      region: region || regionFallback || "Ukjent region",
      reasoning,
    });
    if (suggestions.length === 3) break;
  }
  return suggestions;
}

function readSummary(draft: unknown, fallback: string): string {
  if (!draft || typeof draft !== "object") return fallback;
  const summary = (draft as { summary?: unknown }).summary;
  return typeof summary === "string" && summary.trim() ? summary.trim() : fallback;
}

export function composeResolution(input: TaskContextInput & {
  nowIso: string;
  modelDraft?: unknown;
}): SmartAssistResolution {
  const now = new Date(input.nowIso);
  const evidence = evidenceFromHits(input.internalHits, now);
  const dataFreshness = overallFreshness(evidence, now);
  const procurement = isProcurementTask(input.taskDescription);
  const commodity = extractCommodity(input.taskDescription);
  const region = extractRegion(input.taskDescription);
  const needsSourcing = procurement && dataFreshness !== "FRESH";
  const sourcingSuggestions = needsSourcing
    ? readSuggestions(input.modelDraft, region)
    : [];

  const fallbackSummary = needsSourcing
    ? commodity
      ? `Ingen fersk intern kilde for ${commodity}${region ? ` i ${region}` : ""}. Navngitte forslag må bekreftes før de blir selskaper.`
      : "Intern dokumentasjon mangler eller er for gammel til å stole på for innkjøp."
    : evidence.length > 0
      ? `Fant ${evidence.length} interne treff. ${dataFreshness === "FRESH" ? "Det nyeste er under 6 måneder." : "Det nyeste bør revalideres."}`
      : "Ingen interne treff på oppgaven.";

  const summary = readSummary(input.modelDraft, fallbackSummary);
  const temporalNote = temporalNoteFor(dataFreshness, evidence);
  const dateLimit = input.dateLimit?.trim() || null;

  if (sourcingSuggestions.length > 0) {
    return {
      summary,
      dataFreshness,
      ...(temporalNote ? { temporalNote } : {}),
      internalEvidence: evidence,
      sourcingSuggestions,
      suggestedNextAction: {
        type: "CREATE_LEADS_AND_CALLS",
        label: `Opprett ${sourcingSuggestions.length} leads og planlegg ringerunde`,
        payload: {
          suggestions: sourcingSuggestions.map((item) => ({
            name: item.name,
            region: item.region,
          })),
          targetDate: dateLimit,
        },
      },
    };
  }

  if (dataFreshness === "OUTDATED" || dataFreshness === "AGING") {
    return {
      summary,
      dataFreshness,
      ...(temporalNote ? { temporalNote } : {}),
      internalEvidence: evidence,
      sourcingSuggestions: [],
      suggestedNextAction: {
        type: "DRAFT_REVALIDATION_EMAIL",
        label: "Utkast til revalidering",
        payload: {
          subject: "Revalidering av råstoff og pris",
          body: temporalNote ?? "Bekreft at pris og volum fortsatt gjelder.",
          targetDate: dateLimit,
        },
      },
    };
  }

  const firstUrl = evidence.find((item) => item.webUrl)?.webUrl;
  return {
    summary,
    dataFreshness,
    ...(temporalNote ? { temporalNote } : {}),
    internalEvidence: evidence,
    sourcingSuggestions: [],
    suggestedNextAction: {
      type: "REVIEW_DOC",
      label: firstUrl ? "Åpne intern kilde" : "Gjennomgå oppgaven",
      payload: {
        ...(firstUrl ? { webUrl: firstUrl } : {}),
        targetDate: dateLimit,
      },
    },
  };
}

async function askModel(input: TaskContextInput, nowIso: string): Promise<unknown | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const baseUrl = (process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(
    /\/$/,
    "",
  );
  const model =
    process.env.OPENAI_SMARTASSIST_MODEL?.trim() ||
    process.env.OPENAI_TENDER_MODEL?.trim() ||
    "gpt-4o-mini";

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify({
            now: nowIso,
            dateLimit: input.dateLimit ?? null,
            taskDescription: input.taskDescription.slice(0, 4_000),
            internalHits: input.internalHits.slice(0, 5).map((hit) => ({
              title: hit.title,
              timestamp: hit.timestamp,
              sourceType: hit.sourceType,
              snippet: hit.snippet.slice(0, 300),
              webUrl: hit.webUrl,
            })),
          }),
        },
      ],
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) return null;
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) return null;
  try {
    return JSON.parse(content) as unknown;
  } catch {
    return null;
  }
}

export async function resolveTaskContext(input: TaskContextInput): Promise<SmartAssistResolution> {
  const nowIso = new Date().toISOString();
  let modelDraft: unknown = null;
  try {
    modelDraft = await askModel(input, nowIso);
  } catch {
    modelDraft = null;
  }
  return composeResolution({ ...input, nowIso, modelDraft });
}
