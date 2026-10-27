/**
 * FS-021 — Token economy. Pure, dependency-free helpers that keep LLM spend
 * at a minimum: price table, cost maths, budget gate, exact-match result
 * cache and usage ledger. No I/O; callers (llm-client) wire it to the model.
 *
 * Prices: USD per million tokens, Anthropic list prices (Oct 2026).
 * A model missing from the table is refused at the gate (never guessed).
 */

import { createHash } from "node:crypto";

export type ModelPrice = {
  inPerM: number;
  outPerM: number;
  cacheWritePerM: number;
  cacheReadPerM: number;
  /** Minimum prefix tokens before cache_control has any effect. */
  minCacheTokens: number;
  /** Model rejects temperature/top_p/top_k. */
  rejectsSampling: boolean;
  /** Above this many prompt tokens a higher tier applies (Haiku 5.5). */
  longPromptTokens?: number;
  long?: Pick<ModelPrice, "inPerM" | "outPerM" | "cacheWritePerM" | "cacheReadPerM">;
};

export const MODEL_PRICES: Record<string, ModelPrice> = {
  "claude-haiku-5-5": {
    inPerM: 0.1,
    outPerM: 0.5,
    cacheWritePerM: 0.125,
    cacheReadPerM: 0.01,
    minCacheTokens: 512,
    rejectsSampling: true,
    longPromptTokens: 100_000,
    long: { inPerM: 0.5, outPerM: 2.5, cacheWritePerM: 0.625, cacheReadPerM: 0.05 },
  },
  "claude-haiku-4-5": {
    inPerM: 1,
    outPerM: 5,
    cacheWritePerM: 1.25,
    cacheReadPerM: 0.1,
    minCacheTokens: 4096,
    rejectsSampling: false,
  },
  "claude-sonnet-5-5": {
    inPerM: 2,
    outPerM: 10,
    cacheWritePerM: 2.5,
    cacheReadPerM: 0.1,
    minCacheTokens: 512,
    rejectsSampling: true,
  },
  "claude-opus-5-5": {
    inPerM: 4,
    outPerM: 20,
    cacheWritePerM: 5,
    cacheReadPerM: 0.2,
    minCacheTokens: 512,
    rejectsSampling: true,
  },
};

export function priceFor(model: string): ModelPrice | null {
  return MODEL_PRICES[model] ?? null;
}

/**
 * Conservative token estimate for budgeting (newer Claude tokenizer is
 * ~30% denser in tokens than the old one: ~3.2 chars/token).
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.2);
}

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens?: number;
  cacheReadTokens?: number;
};

/** USD cost of one call, or null when the model has no known price. */
export function computeCost(model: string, usage: TokenUsage): number | null {
  const base = priceFor(model);
  if (!base) return null;
  const write = usage.cacheWriteTokens ?? 0;
  const read = usage.cacheReadTokens ?? 0;
  const promptTokens = usage.inputTokens + write + read;
  const p =
    base.long && base.longPromptTokens && promptTokens > base.longPromptTokens
      ? base.long
      : base;
  return (
    (usage.inputTokens * p.inPerM +
      write * p.cacheWritePerM +
      read * p.cacheReadPerM +
      usage.outputTokens * p.outPerM) /
    1_000_000
  );
}

/** Whether a prefix is long enough for cache_control to take effect. */
export function canCachePrefix(model: string, prefixTokens: number): boolean {
  const p = priceFor(model);
  return !!p && prefixTokens >= p.minCacheTokens;
}

// ---------------------------------------------------------------- cache
// (usageLedger singleton is exported at the bottom of this file)

export function cacheKey(...parts: Array<string | number | null | undefined>): string {
  const hash = createHash("sha256");
  for (const part of parts) {
    hash.update(String(part ?? ""));
    hash.update("\u0000");
  }
  return hash.digest("hex");
}

/**
 * Exact-match result cache (LRU + TTL). Exact only — semantic caching can
 * return another meeting's answer, which violates Reality First.
 */
export class ResultCache<T> {
  private readonly store = new Map<string, { value: T; expires: number }>();

  constructor(
    private readonly maxEntries = 500,
    private readonly ttlMs = 24 * 60 * 60 * 1000,
    private readonly now: () => number = Date.now,
  ) {}

  get(key: string): T | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (hit.expires <= this.now()) {
      this.store.delete(key);
      return undefined;
    }
    // refresh recency
    this.store.delete(key);
    this.store.set(key, hit);
    return hit.value;
  }

  set(key: string, value: T): void {
    this.store.delete(key);
    this.store.set(key, { value, expires: this.now() + this.ttlMs });
    while (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest === undefined) break;
      this.store.delete(oldest);
    }
  }

  get size(): number {
    return this.store.size;
  }
}

// --------------------------------------------------------------- ledger

export type LedgerEntry = {
  at: number;
  task: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  costUsd: number | null;
  /** "call" = paid model call, "cache" = exact-cache hit, "blocked" = gate refused. */
  kind: "call" | "cache" | "blocked";
};

export type BudgetLimits = {
  dailyUsd: number;
  monthlyUsd: number;
  maxInputTokens: number;
};

const DEFAULT_LIMITS: BudgetLimits = {
  dailyUsd: 5,
  monthlyUsd: 50,
  maxInputTokens: 30_000,
};

function positive(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function limitsFromEnv(env: Record<string, string | undefined> = process.env): BudgetLimits {
  return {
    dailyUsd: positive(env.LLM_DAILY_BUDGET_USD) ?? DEFAULT_LIMITS.dailyUsd,
    monthlyUsd: positive(env.LLM_MONTHLY_BUDGET_USD) ?? DEFAULT_LIMITS.monthlyUsd,
    maxInputTokens: positive(env.LLM_MAX_INPUT_TOKENS) ?? DEFAULT_LIMITS.maxInputTokens,
  };
}

export type GateDecision = { ok: true } | { ok: false; reason: string };

/**
 * In-memory ledger (per server instance). Spend persistence across restarts
 * is a follow-up (needs a Prisma table); the gate is therefore a safety net
 * per instance, not an accounting system of record.
 */
export class UsageLedger {
  private entries: LedgerEntry[] = [];

  constructor(
    private readonly limits: () => BudgetLimits = limitsFromEnv,
    private readonly now: () => number = Date.now,
    private readonly maxEntries = 5000,
  ) {}

  record(entry: Omit<LedgerEntry, "at">): void {
    this.entries.push({ ...entry, at: this.now() });
    if (this.entries.length > this.maxEntries) {
      this.entries.splice(0, this.entries.length - this.maxEntries);
    }
  }

  spentSince(sinceMs: number): number {
    return this.entries.reduce(
      (sum, e) => (e.at >= sinceMs && e.costUsd ? sum + e.costUsd : sum),
      0,
    );
  }

  /** Decide whether a call may be made. Unknown models are refused. */
  gate(model: string, estimatedInputTokens: number): GateDecision {
    if (!priceFor(model)) return { ok: false, reason: `unpriced model: ${model}` };
    const limits = this.limits();
    if (estimatedInputTokens > limits.maxInputTokens) {
      return { ok: false, reason: "input exceeds token cap" };
    }
    const now = this.now();
    if (this.spentSince(now - 24 * 60 * 60 * 1000) >= limits.dailyUsd) {
      return { ok: false, reason: "daily budget reached" };
    }
    if (this.spentSince(now - 30 * 24 * 60 * 60 * 1000) >= limits.monthlyUsd) {
      return { ok: false, reason: "monthly budget reached" };
    }
    return { ok: true };
  }

  summary(sinceMs = this.now() - 24 * 60 * 60 * 1000) {
    const rows = this.entries.filter((e) => e.at >= sinceMs);
    const byTask: Record<string, { calls: number; cacheHits: number; blocked: number; costUsd: number }> = {};
    for (const e of rows) {
      const t = (byTask[e.task] ??= { calls: 0, cacheHits: 0, blocked: 0, costUsd: 0 });
      if (e.kind === "call") t.calls += 1;
      else if (e.kind === "cache") t.cacheHits += 1;
      else t.blocked += 1;
      t.costUsd += e.costUsd ?? 0;
    }
    return {
      costUsd: rows.reduce((s, e) => s + (e.costUsd ?? 0), 0),
      inputTokens: rows.reduce((s, e) => s + e.inputTokens, 0),
      outputTokens: rows.reduce((s, e) => s + e.outputTokens, 0),
      cacheReadTokens: rows.reduce((s, e) => s + e.cacheReadTokens, 0),
      byTask,
    };
  }
}

/** Process-wide ledger (per server instance). */
export const usageLedger = new UsageLedger();
