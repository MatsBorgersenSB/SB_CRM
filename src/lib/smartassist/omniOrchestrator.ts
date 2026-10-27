import { openAiJsonText } from "@/lib/ai/openai-json";
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
Write summary, temporalNote, and reasoning in plain English for a business reader. Keep sourcingSuggestions to at most 3 items.`;

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
    return "Our internal records are more than 12 months old. Prices and availability are outdated and must be re-confirmed.";
  }
  if (freshness === "AGING") {
    return "Our newest internal record is 6 to 12 months old. Prices, feedstock offers and availability are uncertain.";
  }
  if (freshness === "FRESH" && outdated > 0) {
    return `${outdated} older ${outdated === 1 ? "record is" : "records are"} marked outdated. Rely only on what is under 6 months old.`;
  }
  if (freshness === "EXTERNAL_ONLY") {
    return "Nothing internal to date this against. Do not assume price or volume.";
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
      region: region || regionFallback || "Region unknown",
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
      ? `We have no fresh internal source for ${commodity}${region ? ` in ${region}` : ""}. Named suggestions must be confirmed before they become companies.`
      : "Our internal records are missing or too old to rely on for procurement."
    : evidence.length > 0
      ? `Found ${evidence.length} internal ${evidence.length === 1 ? "record" : "records"}. ${dataFreshness === "FRESH" ? "The newest is under 6 months old." : "The newest should be re-confirmed."}`
      : "Nothing in mail, files or Teams matches this yet.";

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
        label: `Add ${sourcingSuggestions.length} supplier ${sourcingSuggestions.length === 1 ? "lead" : "leads"} and plan the calls`,
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
        label: "Draft a re-confirmation email",
        payload: {
          subject: "Re-confirming feedstock and price",
          body: temporalNote ?? "Please confirm that price and volume still apply.",
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
      label: firstUrl ? "Open the internal source" : "Review the task",
      payload: {
        ...(firstUrl ? { webUrl: firstUrl } : {}),
        targetDate: dateLimit,
      },
    },
  };
}

async function askModel(input: TaskContextInput, nowIso: string): Promise<unknown | null> {
  const model =
    process.env.OPENAI_SMARTASSIST_MODEL?.trim() ||
    process.env.OPENAI_TENDER_MODEL?.trim() ||
    "gpt-4o-mini";

  const content = await openAiJsonText({
    task: "smartassist-task-context",
    model,
    system: SYSTEM_PROMPT,
    user: JSON.stringify({
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
  });
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
