import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { analyzeOpportunityMail } from "./mail-todo-detection";
import type { CorrespondenceMailSnippet } from "./correspondence-action-signals";

const NOW = new Date("2026-10-23T12:00:00Z");

function mail(
  id: string,
  over: Partial<CorrespondenceMailSnippet> & Pick<CorrespondenceMailSnippet, "sentAt">,
): CorrespondenceMailSnippet {
  return {
    id,
    conversationId: "c1",
    subject: "Biochar",
    bodyPreview: "",
    isOutbound: false,
    ...over,
  };
}

const MISSING = [
  { fieldId: "capacity", label: "Quantity or size" },
  { fieldId: "timeline", label: "Needed by" },
];

describe("mail check", () => {
  it("flags what we owe when the client asked and we have not answered", () => {
    const result = analyzeOpportunityMail(
      [
        mail("m1", {
          sentAt: "2026-10-20T09:00:00Z",
          bodyPreview: "Hi, can you send us a quote for biochar?",
        }),
      ],
      [],
      NOW,
    );
    assert.equal(result.weOwe.length, 1);
    assert.equal(result.weOwe[0]!.source, "client_asked");
    assert.equal(result.clientOwes.length, 0);
  });

  it("clears the todo once we replied", () => {
    const result = analyzeOpportunityMail(
      [
        mail("m1", { sentAt: "2026-10-20T09:00:00Z", bodyPreview: "Can you send a quote?" }),
        mail("m2", {
          sentAt: "2026-10-20T15:00:00Z",
          isOutbound: true,
          bodyPreview: "Thanks, here you go.",
        }),
      ],
      [],
      NOW,
    );
    assert.equal(result.weOwe.length, 0);
  });

  it("flags what the client owes when our request got no answer", () => {
    const result = analyzeOpportunityMail(
      [
        mail("m1", {
          sentAt: "2026-10-19T09:00:00Z",
          isOutbound: true,
          bodyPreview: "Please confirm the delivery address and quantity.",
        }),
      ],
      [],
      NOW,
    );
    assert.equal(result.clientOwes.length, 1);
    assert.equal(result.clientOwes[0]!.source, "we_asked");
  });

  it("does not nag about a request sent today", () => {
    const result = analyzeOpportunityMail(
      [
        mail("m1", {
          sentAt: "2026-10-23T08:00:00Z",
          isOutbound: true,
          bodyPreview: "Please confirm the quantity.",
        }),
      ],
      [],
      NOW,
    );
    assert.equal(result.clientOwes.length, 0);
  });

  it("reuses what the client already wrote before asking again", () => {
    const result = analyzeOpportunityMail(
      [
        mail("m1", {
          sentAt: "2026-10-21T09:00:00Z",
          bodyPreview: "We need 20 tonnes of biochar, delivery by week 45.",
        }),
      ],
      MISSING,
      NOW,
    );
    assert.deepEqual(
      result.suggestions.map((s) => s.fieldId).sort(),
      ["capacity", "timeline"],
    );
    assert.equal(result.askClient.length, 0);
    assert.match(result.suggestions.find((s) => s.fieldId === "capacity")!.excerpt, /20 tonnes/);
  });

  it("asks the client only for what mail does not hold, and never invents facts", () => {
    const none = analyzeOpportunityMail(
      [mail("m1", { sentAt: "2026-10-21T09:00:00Z", bodyPreview: "Hello, interested." })],
      MISSING,
      NOW,
    );
    assert.equal(none.suggestions.length, 0);
    assert.equal(none.askClient.length, 2);

    // Our own outbound wording is not a client statement.
    const ours = analyzeOpportunityMail(
      [
        mail("m1", {
          sentAt: "2026-10-21T09:00:00Z",
          isOutbound: true,
          bodyPreview: "We can deliver 20 tonnes by week 45.",
        }),
      ],
      MISSING,
      NOW,
    );
    assert.equal(ours.suggestions.length, 0);
  });
});
