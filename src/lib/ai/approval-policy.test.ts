import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  decideApproval,
  reviewTransition,
  selectStorableProposals,
} from "./approval-policy";
import type { KnowledgeProposal } from "./knowledge-proposal";

const base: KnowledgeProposal = {
  type: "fact",
  statement: "The site plan is outstanding.",
  impact: "Permitting cannot start without it.",
  evidence: "We have not received the site plan",
  confidence: "high",
  source: { kind: "meeting", id: null, label: "Test" },
  ownerHint: null,
  dueHint: null,
};

describe("decideApproval", () => {
  it("never auto-applies entity create or modify, even at high confidence", () => {
    for (const action of ["create_entity", "modify_entity"] as const) {
      assert.equal(decideApproval(base, action).mode, "requires_approval");
    }
  });

  it("never auto-applies relationship knowledge", () => {
    const p = { ...base, type: "relationship" as const };
    assert.equal(decideApproval(p, "store_note").mode, "requires_approval");
  });

  it("allows undoable auto-apply only for high confidence + low risk", () => {
    assert.equal(decideApproval(base, "store_note").mode, "auto_apply_undoable");
    assert.equal(decideApproval(base, "log_activity").mode, "auto_apply_undoable");
  });

  it("only suggests at moderate or low confidence", () => {
    for (const confidence of ["moderate", "low"] as const) {
      assert.equal(decideApproval({ ...base, confidence }, "store_note").mode, "suggest");
    }
  });
});

describe("selectStorableProposals", () => {
  it("excludes commitments (owned by MeetingCommitmentRecord)", () => {
    const kept = selectStorableProposals([
      { ...base, type: "commitment" },
      { ...base, type: "risk" },
      { ...base, type: "unknown" },
    ]);
    assert.deepEqual(kept.map((p) => p.type), ["risk", "unknown"]);
  });
});

describe("reviewTransition", () => {
  it("accepts and dismisses a pending proposal", () => {
    assert.deepEqual(reviewTransition("proposed", "accept"), {
      ok: true,
      status: "accepted",
      statement: null,
    });
    assert.deepEqual(reviewTransition("proposed", "dismiss"), {
      ok: true,
      status: "dismissed",
      statement: null,
    });
  });

  it("requires new wording for an edit and keeps the user's text", () => {
    assert.equal(reviewTransition("proposed", "edit", "  ").ok, false);
    assert.deepEqual(reviewTransition("proposed", "edit", " Better wording "), {
      ok: true,
      status: "edited",
      statement: "Better wording",
    });
  });

  it("refuses to re-decide an already reviewed proposal", () => {
    for (const status of ["accepted", "edited", "dismissed"] as const) {
      assert.equal(reviewTransition(status, "accept").ok, false);
    }
  });
});
