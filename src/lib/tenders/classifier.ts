import "server-only";

import {
  isTenderSectorTag,
  isTenderTechnologyType,
  POSITIVE_KEYWORDS,
  PYROLYSIS_KEYWORDS,
  TORREFACTION_KEYWORDS,
  suggestSectorTag,
  type ThermalFilterResult,
  type ThermalNoticeInput,
} from "@/lib/tenders/thermalFilter";
import type { SmartAssistTenderClassification } from "@/lib/tenders/types";

const CLASSIFIER_PROMPT =
  "Analyze this tender notice. Does it explicitly require pyrolysis technology, torrefaction, biochar, biocoal, or thermo-chemical carbonization? Respond in JSON: { qualified: boolean, confidence: number, technologyType: 'Pyrolysis' | 'Torrefaction' | 'Both', sectorTag: 'Timber & Forestry' | 'Municipal & Sludge' | 'Energy & Utilities', summary: string }.";

function clipSummary(value: string): string {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= 480) return compact;
  return `${compact.slice(0, 477).trimEnd()}…`;
}

function keywordHits(haystack: string, phrases: readonly string[]): number {
  return phrases.filter((phrase) => haystack.includes(phrase.toLowerCase())).length;
}

export function classifyThermalNoticeDeterministic(
  notice: ThermalNoticeInput,
  filter: Extract<ThermalFilterResult, { accepted: true }>,
): SmartAssistTenderClassification {
  const pyrolysisHits = keywordHits(filter.haystack, PYROLYSIS_KEYWORDS);
  const torrefactionHits = keywordHits(filter.haystack, TORREFACTION_KEYWORDS);
  const positiveHits = keywordHits(filter.haystack, POSITIVE_KEYWORDS);
  const qualified = positiveHits > 0;

  let confidence = 40;
  if (qualified) {
    confidence = 82 + Math.min(12, positiveHits * 3);
    if (notice.title.toLowerCase().match(/pyrolysis|torrefaction|biochar|biocoal|biokull/)) {
      confidence = Math.max(confidence, 90);
    }
  }

  const technologyType =
    pyrolysisHits > 0 && torrefactionHits > 0
      ? "Both"
      : torrefactionHits > 0
        ? "Torrefaction"
        : "Pyrolysis";

  const sectorTag = suggestSectorTag(filter.haystack);
  const techLabel =
    technologyType === "Both"
      ? "pyrolysis and torrefaction"
      : technologyType.toLowerCase();

  const summary = qualified
    ? `${notice.authorityName} published “${notice.title}” requiring ${techLabel} in ${notice.country}. ${sectorTag} is the best-fit sector. Submission deadline is ${filter.submissionDeadline.toISOString().slice(0, 10)}.`
    : `${notice.authorityName} published “${notice.title}”, but the notice does not explicitly require pyrolysis, torrefaction, biochar, biocoal, or thermo-chemical carbonization.`;

  return {
    qualified,
    confidence: Math.min(99, Math.max(0, Math.round(confidence))),
    technologyType,
    sectorTag,
    summary: clipSummary(summary),
  };
}

function parseClassificationJson(raw: string): SmartAssistTenderClassification | null {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) return null;

  try {
    const parsed = JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
    if (typeof parsed.qualified !== "boolean") return null;
    const confidence = Number(parsed.confidence);
    if (!Number.isFinite(confidence)) return null;
    const technologyType = String(parsed.technologyType ?? "");
    const sectorTag = String(parsed.sectorTag ?? "");
    if (!isTenderTechnologyType(technologyType) || !isTenderSectorTag(sectorTag)) return null;
    const summary = clipSummary(String(parsed.summary ?? ""));
    if (!summary) return null;
    return {
      qualified: parsed.qualified,
      confidence: Math.min(100, Math.max(0, Math.round(confidence))),
      technologyType,
      sectorTag,
      summary,
    };
  } catch {
    return null;
  }
}

async function classifyWithOpenAi(
  notice: ThermalNoticeInput,
  filter: Extract<ThermalFilterResult, { accepted: true }>,
): Promise<SmartAssistTenderClassification | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const baseUrl = (process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(
    /\/$/,
    "",
  );
  const model = process.env.OPENAI_TENDER_MODEL?.trim() || "gpt-4o-mini";

  const userPayload = {
    title: notice.title,
    authorityName: notice.authorityName,
    country: notice.country,
    publicationDate: filter.publicationDate.toISOString(),
    submissionDeadline: filter.submissionDeadline.toISOString(),
    summary: notice.summary ?? "",
    rawText: (notice.rawText ?? "").slice(0, 6_000),
    source: notice.source,
  };

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
        { role: "system", content: CLASSIFIER_PROMPT },
        { role: "user", content: JSON.stringify(userPayload) },
      ],
    }),
  });

  if (!response.ok) {
    console.warn("[tenders] OpenAI classifier HTTP", response.status);
    return null;
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) return null;
  return parseClassificationJson(content);
}

export async function classifyThermalNotice(
  notice: ThermalNoticeInput,
  filter: Extract<ThermalFilterResult, { accepted: true }>,
): Promise<SmartAssistTenderClassification> {
  try {
    const llm = await classifyWithOpenAi(notice, filter);
    if (llm) return llm;
  } catch (error) {
    console.warn(
      "[tenders] OpenAI classifier failed:",
      error instanceof Error ? error.message : error,
    );
  }
  return classifyThermalNoticeDeterministic(notice, filter);
}

export { CLASSIFIER_PROMPT };
