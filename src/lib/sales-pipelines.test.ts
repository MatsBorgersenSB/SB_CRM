import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PipelineRow } from "@/types/pipeline";
import { projectWonGateBlockers } from "./project-conditions";
import {
  classifyMove,
  columnFor,
  columnValue,
  moveRequiresReason,
  SALES_PIPELINES,
  salesStageOf,
  stagePatch,
} from "./sales-pipelines";

function deal(over: Partial<PipelineRow> = {}): PipelineRow {
  return {
    id: "PL-T1",
    assetName: "Test deal",
    companyRole: "Technology Buyer",
    targetFeedstock: "",
    reactorDesignCapacity: 0,
    currentMilestone: "",
    status: "Prospecting",
    salesValue: 0,
    currency: "EUR",
    probability: 20,
    ...over,
  } as PipelineRow;
}

const project = SALES_PIPELINES["project-sales"];
const offer = SALES_PIPELINES["offer-sales"];

describe("sales pipelines (FS-022)", () => {
  it("derives the stage from legacy status when none is stored", () => {
    assert.equal(salesStageOf(deal({ status: "Feedstock Analysis" })), "discovery");
    assert.equal(salesStageOf(deal({ status: "Live Production" })), "won");
    assert.equal(salesStageOf(deal({ salesStageId: "lost" })), "lost");
  });

  it("classifies moves", () => {
    assert.equal(classifyMove(project, "prospecting", "qualification").kind, "forward");
    assert.equal(classifyMove(project, "prospecting", "proposal").kind, "skip");
    assert.equal(classifyMove(project, "proposal", "qualification").kind, "back");
    assert.equal(classifyMove(project, "proposal", "lost").kind, "lost");
    assert.equal(classifyMove(project, "lost", "prospecting").kind, "reopen");
    assert.equal(classifyMove(project, "prospecting", "prospecting").kind, "same");
  });

  it("requires a reason only for lost and skip", () => {
    assert.equal(moveRequiresReason({ kind: "lost" }), true);
    assert.equal(moveRequiresReason({ kind: "skip", steps: 2 }), true);
    assert.equal(moveRequiresReason({ kind: "forward" }), false);
    assert.equal(moveRequiresReason({ kind: "back" }), false);
  });

  it("offer sales holds Qualified deals in Needs understood", () => {
    assert.equal(columnFor(offer, "qualification")?.id, "discovery");
    assert.equal(classifyMove(offer, "prospecting", "discovery").kind, "forward");
  });

  it("stage patches keep the legacy status mirrored", () => {
    assert.deepEqual(stagePatch("negotiation"), {
      salesStageId: "negotiation",
      status: "Contract Negotiation",
    });
    assert.deepEqual(stagePatch("lost"), { salesStageId: "lost" });
  });

  it("column totals are unknown when any value is unknown", () => {
    const known = columnValue([
      { salesValue: 100, currency: "EUR" },
      { salesValue: 50, currency: "EUR" },
    ]);
    assert.equal(known.total, 150);
    const unknown = columnValue([
      { salesValue: 100, currency: "EUR" },
      { salesValue: 0, currency: "EUR" },
    ]);
    assert.equal(unknown.total, null);
  });

  it("the Won gate blocks a project drop with unconfirmed conditions, never an offer", () => {
    const system = deal({ offeringIds: ["sys-complete-turnkey-pyrolysis"] });
    const offerDeal = deal({ offeringIds: ["prod-dryer"] });
    assert.ok(projectWonGateBlockers(system, stagePatch("won")).length > 0);
    assert.equal(projectWonGateBlockers(offerDeal, stagePatch("won")).length, 0);
    assert.equal(projectWonGateBlockers(system, stagePatch("proposal")).length, 0);
  });
});
