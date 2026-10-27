/**
 * FS-021 — Guarded OpenAI-compatible JSON call. Shared by the SmartAssist
 * extractors that still use chat/completions. Adds exact-match caching, an
 * input-size cap and ledger recording so no site calls the API unmetered.
 *
 * Cost is recorded as null (no verified price table for these models); token
 * counts are still logged. The $ budget gate applies to the Anthropic path.
 */

import {
  ResultCache,
  cacheKey,
  estimateTokens,
  limitsFromEnv,
  usageLedger,
} from "./token-economy";

const cache = new ResultCache<string>();

export type OpenAiJsonRequest = {
  task: string;
  system: string;
  user: string;
  model: string;
  timeoutMs?: number;
};

/** Returns the raw JSON text from the model, or null when unavailable/blocked/failed. */
export async function openAiJsonText(request: OpenAiJsonRequest): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  const baseUrl = (process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/$/, "");
  const { task, model } = request;
  const blank = { inputTokens: 0, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0, costUsd: null };

  const key = cacheKey(task, model, request.system, request.user);
  const hit = cache.get(key);
  if (hit !== undefined) {
    usageLedger.record({ task, model, ...blank, costUsd: 0, kind: "cache" });
    return hit;
  }

  if (estimateTokens(request.system + request.user) > limitsFromEnv().maxInputTokens) {
    usageLedger.record({ task, model, ...blank, kind: "blocked" });
    return null;
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: request.system },
        { role: "user", content: request.user },
      ],
    }),
    signal: AbortSignal.timeout(request.timeoutMs ?? 20_000),
  });
  if (!response.ok) return null;

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  usageLedger.record({
    task,
    model,
    inputTokens: payload.usage?.prompt_tokens ?? 0,
    outputTokens: payload.usage?.completion_tokens ?? 0,
    cacheWriteTokens: 0,
    cacheReadTokens: 0,
    costUsd: null,
    kind: "call",
  });

  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) return null;
  cache.set(key, content);
  return content;
}
