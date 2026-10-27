/**
 * FS-021 — Shared LLM access. Every structured extraction goes through here.
 * No route or engine should call the Anthropic SDK directly.
 *
 * Token economy (see token-economy.ts): exact-match result cache, priced-model
 * gate, input/daily/monthly caps, usage ledger, prompt caching only when the
 * prefix is long enough for it to take effect.
 *
 * Transport is injectable so extraction logic can be tested without a model.
 */

import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import {
  ResultCache,
  usageLedger,
  cacheKey,
  canCachePrefix,
  computeCost,
  estimateTokens,
  priceFor,
} from "./token-economy";

export type StructuredTaskInput = {
  /** Short task id for logging, e.g. "meeting-knowledge". */
  task: string;
  system: string;
  user: string;
  toolName: string;
  toolDescription: string;
  /** JSON schema (object) for the tool input. */
  inputSchema: Record<string, unknown>;
  maxTokens?: number;
  /** Pin a model for this call (e.g. a legacy per-feature env override). */
  model?: string;
  /**
   * Optional image / PDF the model must read (e.g. a scanned business card).
   * Calls with an attachment are never result-cached: the cache key does not
   * cover the bytes, so a shared entry would return another file's answer.
   */
  attachment?: LlmAttachment;
};

export type LlmAttachment =
  | { kind: "image"; mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp"; base64: string }
  | { kind: "document"; mediaType: "application/pdf"; base64: string };

/** Conservative per-file token estimates used only for the budget gate. */
const ATTACHMENT_TOKEN_ESTIMATE = { image: 1600, document: 3500 } as const;

function attachmentBlock(
  attachment: LlmAttachment,
): Anthropic.ImageBlockParam | Anthropic.DocumentBlockParam {
  if (attachment.kind === "document") {
    return {
      type: "document",
      source: { type: "base64", media_type: attachment.mediaType, data: attachment.base64 },
    };
  }
  return {
    type: "image",
    source: { type: "base64", media_type: attachment.mediaType, data: attachment.base64 },
  };
}

/** Resolves to the parsed tool input, or null when unavailable/failed/blocked. */
export type LlmTransport = (input: StructuredTaskInput) => Promise<unknown | null>;

const DEFAULT_MODEL = "claude-haiku-5-5";
/** System-prompt overhead the API adds for a forced tool call (Haiku 5.5). */
const FORCED_TOOL_OVERHEAD_TOKENS = 406;

const resultCache = new ResultCache<unknown>();

function modelForTask(task: string, pinned?: string): string {
  const specific = process.env[`ANTHROPIC_MODEL_${task.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`];
  return (
    specific?.trim() ||
    pinned?.trim() ||
    process.env.ANTHROPIC_EXTRACT_MODEL?.trim() ||
    DEFAULT_MODEL
  );
}

/** Returns null when no API key is configured (callers fall back to heuristics). */
export function getDefaultTransport(): LlmTransport | null {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });

  return async (input) => {
    const model = modelForTask(input.task, input.model);
    const price = priceFor(model);
    const started = Date.now();
    const blank = { inputTokens: 0, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0 };

    const schemaJson = JSON.stringify(input.inputSchema);
    const key = cacheKey(
      input.task,
      model,
      input.system,
      input.user,
      input.toolName,
      input.toolDescription,
      schemaJson,
      input.maxTokens,
    );

    const cached = input.attachment ? undefined : resultCache.get(key);
    if (cached !== undefined) {
      usageLedger.record({ task: input.task, model, ...blank, costUsd: 0, kind: "cache" });
      return cached;
    }

    const prefixTokens =
      estimateTokens(input.system) +
      estimateTokens(schemaJson + input.toolDescription) +
      FORCED_TOOL_OVERHEAD_TOKENS;
    const attachmentTokens = input.attachment
      ? ATTACHMENT_TOKEN_ESTIMATE[input.attachment.kind]
      : 0;
    const gate = usageLedger.gate(
      model,
      prefixTokens + estimateTokens(input.user) + attachmentTokens,
    );
    if (!gate.ok) {
      usageLedger.record({ task: input.task, model, ...blank, costUsd: null, kind: "blocked" });
      console.warn("[ai] blocked", { task: input.task, model, reason: gate.reason });
      return null;
    }

    try {
      const message = await client.messages.create({
        model,
        max_tokens: input.maxTokens ?? 2048,
        // Newer models reject sampling params; older ones stay deterministic.
        ...(price?.rejectsSampling ? {} : { temperature: 0 }),
        system: [
          {
            type: "text",
            text: input.system,
            // Only when the prefix clears the model's minimum (else silently ignored).
            ...(canCachePrefix(model, prefixTokens)
              ? { cache_control: { type: "ephemeral" as const } }
              : {}),
          },
        ],
        messages: [
          {
            role: "user",
            content: input.attachment
              ? [attachmentBlock(input.attachment), { type: "text", text: input.user }]
              : input.user,
          },
        ],
        tools: [
          {
            name: input.toolName,
            description: input.toolDescription,
            input_schema: input.inputSchema as Anthropic.Tool["input_schema"],
          },
        ],
        tool_choice: { type: "tool", name: input.toolName },
      });

      const usage = {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
        cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
        cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
      };
      const costUsd = computeCost(model, usage);
      usageLedger.record({ task: input.task, model, ...usage, costUsd, kind: "call" });

      // Metadata only — never log content.
      console.info("[ai]", {
        task: input.task,
        model,
        ms: Date.now() - started,
        ...usage,
        costUsd,
      });

      if (message.stop_reason === "refusal") return null;
      const block = message.content.find((item) => item.type === "tool_use");
      if (!block || block.type !== "tool_use") return null;
      if (!input.attachment) resultCache.set(key, block.input);
      return block.input;
    } catch (error) {
      console.warn("[ai] task failed", {
        task: input.task,
        model,
        ms: Date.now() - started,
        error: error instanceof Error ? error.message : "unknown",
      });
      return null;
    }
  };
}
