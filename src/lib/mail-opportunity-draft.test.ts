import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildMailOpportunityDraft,
  mailOpportunityImpact,
  mailTopic,
  matchingOpportunityForTopic,
  suggestOfferingIdsForTopic,
} from "./mail-opportunity-draft";

describe("mail opportunity draft", () => {
  it("uses the subject as the opportunity name and a short product suggestion", () => {
    assert.equal(mailTopic("Re: Biokull"), "Biokull");
    const draft = buildMailOpportunityDraft({
      emailId: "m1",
      conversationId: "c1",
      subject: "Re: Biokull",
      bodyPreview: "Takk for din forespørsel. Vi kan levere i bigbag.",
      contactId: "p1",
      contactName: "Peter Van Der Ende",
    });
    assert.ok(draft);
    assert.equal(draft.assetName, "Biokull");
    assert.equal(suggestOfferingIdsForTopic("Biokull").length, 1);
    assert.match(
      mailOpportunityImpact({
        topic: "Biokull",
        contactName: "Peter Van Der Ende",
        existingDealName: null,
      }),
      /Peter Van Der Ende's mail is about Biokull/,
    );
  });

  it("matches an existing opportunity on the same topic", () => {
    const match = matchingOpportunityForTopic(
      [{ id: "d1", assetName: "Moland Gård - Biokull" }],
      "Biokull",
    );
    assert.equal(match?.id, "d1");
  });

  it("does not turn a long subject into a product", () => {
    assert.deepEqual(
      suggestOfferingIdsForTopic("Can we review the site plan next Tuesday morning"),
      [],
    );
  });
});
