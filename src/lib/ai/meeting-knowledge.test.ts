import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateProposals } from "./knowledge-proposal";
import {
  extractMeetingInsightsSmart,
  extractMeetingKnowledge,
} from "./meeting-knowledge";

const SOURCE = { kind: "meeting", id: null, label: "Test meeting" } as const;

const TRANSCRIPT = `Anna: We will send the revised quote by Friday.
Mats: The board still has to approve the budget.
Anna: We have not received the site plan from the municipality.`;

const good = {
  type: "commitment",
  statement: "Anna will send the revised quote.",
  impact: "The quote gates the customer's budget decision.",
  evidence: "We will send the revised quote by Friday",
  confidence: "high",
  ownerHint: "Anna",
  dueHint: "Friday",
};

describe("validateProposals (no-invention evals)", () => {
  it("keeps a grounded proposal", () => {
    const { proposals, rejected } = validateProposals([good], TRANSCRIPT, SOURCE);
    assert.equal(proposals.length, 1);
    assert.equal(rejected.length, 0);
    assert.equal(proposals[0].ownerHint, "Anna");
    assert.equal(proposals[0].dueHint, "Friday");
  });

  it("rejects evidence that is not in the source", () => {
    const { proposals, rejected } = validateProposals(
      [{ ...good, evidence: "We will deliver the prototype next month" }],
      TRANSCRIPT,
      SOURCE,
    );
    assert.equal(proposals.length, 0);
    assert.equal(rejected[0].reason, "evidence_not_in_source");
  });

  it("rejects proposals without impact", () => {
    const { proposals, rejected } = validateProposals(
      [{ ...good, impact: "" }],
      TRANSCRIPT,
      SOURCE,
    );
    assert.equal(proposals.length, 0);
    assert.equal(rejected[0].reason, "missing_impact");
  });

  it("rejects invalid types", () => {
    const { rejected } = validateProposals([{ ...good, type: "opportunity" }], TRANSCRIPT, SOURCE);
    assert.equal(rejected[0].reason, "invalid_type");
  });

  it("drops invented owner and due hints", () => {
    const { proposals } = validateProposals(
      [{ ...good, ownerHint: "Dr. Invented", dueHint: "next Tuesday" }],
      TRANSCRIPT,
      SOURCE,
    );
    assert.equal(proposals[0].ownerHint, null);
    assert.equal(proposals[0].dueHint, null);
  });

  it("matches evidence across whitespace and quote differences", () => {
    const { proposals } = validateProposals(
      [{ ...good, evidence: "we will   send the revised\nquote by friday" }],
      TRANSCRIPT,
      SOURCE,
    );
    assert.equal(proposals.length, 1);
  });

  it("dedupes and treats non-array output as empty", () => {
    assert.equal(validateProposals([good, good], TRANSCRIPT, SOURCE).proposals.length, 1);
    assert.equal(validateProposals("nope", TRANSCRIPT, SOURCE).proposals.length, 0);
  });
});

describe("extractMeetingKnowledge", () => {
  it("returns null without a transport (caller falls back)", async () => {
    assert.equal(await extractMeetingKnowledge(TRANSCRIPT, SOURCE, null), null);
  });

  it("returns null when the transport fails or throws", async () => {
    assert.equal(await extractMeetingKnowledge(TRANSCRIPT, SOURCE, async () => null), null);
    assert.equal(
      await extractMeetingKnowledge(TRANSCRIPT, SOURCE, async () => {
        throw new Error("boom");
      }),
      null,
    );
  });

  it("empty model output is valid and yields no proposals", async () => {
    const result = await extractMeetingKnowledge(TRANSCRIPT, SOURCE, async () => ({
      summary: "Brief check-in.",
      items: [],
    }));
    assert.equal(result?.proposals.length, 0);
    assert.equal(result?.origin, "llm");
  });

  it("filters hallucinated items from model output", async () => {
    const result = await extractMeetingKnowledge(TRANSCRIPT, SOURCE, async () => ({
      summary: "Quote and budget discussed.",
      items: [good, { ...good, statement: "Invented", evidence: "Never said this" }],
    }));
    assert.equal(result?.proposals.length, 1);
    assert.equal(result?.rejectedCount, 1);
  });
});

describe("extractMeetingInsightsSmart", () => {
  it("falls back to heuristics when the model is unavailable", async () => {
    const insights = await extractMeetingInsightsSmart(TRANSCRIPT, SOURCE, null);
    assert.equal(insights.origin, "heuristic");
    assert.deepEqual(insights.proposals, []);
  });

  it("maps only commitments to action items", async () => {
    const insights = await extractMeetingInsightsSmart(TRANSCRIPT, SOURCE, async () => ({
      summary: "Quote follow-up agreed.",
      items: [
        good,
        {
          type: "unknown",
          statement: "The site plan from the municipality is still missing.",
          impact: "Permitting timeline cannot be estimated.",
          evidence: "We have not received the site plan from the municipality",
          confidence: "high",
          ownerHint: "",
          dueHint: "",
        },
      ],
    }));
    assert.equal(insights.origin, "llm");
    assert.equal(insights.actionItems.length, 1);
    assert.equal(insights.actionItems[0].ownerHint, "Anna");
    assert.equal(insights.proposals.length, 2);
  });
});
