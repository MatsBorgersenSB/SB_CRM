import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ResultCache,
  UsageLedger,
  cacheKey,
  canCachePrefix,
  computeCost,
  estimateTokens,
} from "./token-economy";

const limits = { dailyUsd: 1, monthlyUsd: 10, maxInputTokens: 1000 };

describe("computeCost", () => {
  it("prices Haiku 5.5 at $0.10 in / $0.50 out per MTok", () => {
    const cost = computeCost("claude-haiku-5-5", { inputTokens: 100_000, outputTokens: 100_000 });
    assert.ok(Math.abs((cost ?? 0) - 0.06) < 1e-9);
  });

  it("charges cache reads at a tenth of input", () => {
    const cost = computeCost("claude-haiku-5-5", {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 100_000,
    });
    assert.ok(Math.abs((cost ?? 0) - 0.001) < 1e-9);
  });

  it("uses the long-prompt tier above 100k prompt tokens", () => {
    const cost = computeCost("claude-haiku-5-5", { inputTokens: 200_000, outputTokens: 0 });
    assert.ok(Math.abs((cost ?? 0) - 0.1) < 1e-9);
  });

  it("returns null for unknown models", () => {
    assert.equal(computeCost("gpt-unknown", { inputTokens: 1, outputTokens: 1 }), null);
  });
});

describe("canCachePrefix", () => {
  it("respects each model's minimum", () => {
    assert.equal(canCachePrefix("claude-haiku-5-5", 600), true);
    assert.equal(canCachePrefix("claude-haiku-4-5", 600), false);
    assert.equal(canCachePrefix("nope", 100_000), false);
  });
});

describe("ResultCache", () => {
  it("returns exact hits and expires by TTL", () => {
    let t = 0;
    const cache = new ResultCache<string>(10, 100, () => t);
    cache.set("a", "x");
    assert.equal(cache.get("a"), "x");
    t = 101;
    assert.equal(cache.get("a"), undefined);
  });

  it("evicts least recently used", () => {
    const cache = new ResultCache<number>(2);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.get("a");
    cache.set("c", 3);
    assert.equal(cache.get("b"), undefined);
    assert.equal(cache.get("a"), 1);
  });

  it("cache keys differ when any part differs", () => {
    assert.notEqual(cacheKey("t", "m", "input"), cacheKey("t", "m", "input2"));
    assert.equal(cacheKey("t", "m", "input"), cacheKey("t", "m", "input"));
    assert.notEqual(cacheKey("ab", "c"), cacheKey("a", "bc"));
  });
});

describe("UsageLedger gate", () => {
  it("refuses unpriced models and oversized input", () => {
    const ledger = new UsageLedger(() => limits);
    assert.equal(ledger.gate("mystery", 10).ok, false);
    assert.equal(ledger.gate("claude-haiku-5-5", 5000).ok, false);
    assert.equal(ledger.gate("claude-haiku-5-5", 500).ok, true);
  });

  it("blocks once the daily budget is spent, then recovers after a day", () => {
    let t = 1_000_000_000;
    const ledger = new UsageLedger(() => limits, () => t);
    ledger.record({
      task: "x",
      model: "claude-haiku-5-5",
      inputTokens: 0,
      outputTokens: 0,
      cacheWriteTokens: 0,
      cacheReadTokens: 0,
      costUsd: 1.5,
      kind: "call",
    });
    assert.equal(ledger.gate("claude-haiku-5-5", 10).ok, false);
    t += 25 * 60 * 60 * 1000;
    assert.equal(ledger.gate("claude-haiku-5-5", 10).ok, true);
  });

  it("summarises calls, cache hits and spend per task", () => {
    const ledger = new UsageLedger(() => limits);
    const base = { model: "claude-haiku-5-5", inputTokens: 10, outputTokens: 5, cacheWriteTokens: 0, cacheReadTokens: 0 };
    ledger.record({ ...base, task: "t", costUsd: 0.01, kind: "call" });
    ledger.record({ ...base, task: "t", costUsd: 0, kind: "cache" });
    const s = ledger.summary();
    assert.equal(s.byTask.t.calls, 1);
    assert.equal(s.byTask.t.cacheHits, 1);
    assert.ok(Math.abs(s.costUsd - 0.01) < 1e-9);
  });
});

describe("estimateTokens", () => {
  it("is conservative (more tokens than chars/4)", () => {
    assert.ok(estimateTokens("a".repeat(400)) > 100);
  });
});
