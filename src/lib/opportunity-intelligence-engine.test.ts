import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectDealRisks } from "./opportunity-intelligence-engine";
import type { PipelineRow } from "@/types/pipeline";

describe("detectDealRisks — Reality First", () => {
  it("never shows the 999-day sentinel when a deal has no activity at all", () => {
    const deal = { id: "PL-1", status: "Prospecting" } as unknown as PipelineRow;
    const risks = detectDealRisks(deal, undefined, [], 50, "Stalled");
    const silence = risks.find((risk) => risk.type === "silence_risk");
    assert.ok(silence, "a deal with no activity is a silence risk");
    assert.doesNotMatch(silence.detail, /999/);
    assert.match(silence.detail, /no deal activity has been recorded/i);
  });
});
