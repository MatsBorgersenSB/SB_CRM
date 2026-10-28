import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSmartMailReplyDraft, replySubject } from "./mail-reply-draft";

describe("buildSmartMailReplyDraft", () => {
  it("addresses the extracted inbound ask and greets the contact by first name", () => {
    const draft = buildSmartMailReplyDraft({
      subject: "Pilot plant offer",
      bodyPreview: "Can you send the revised price by Friday?",
      contactName: "Simen Eriksen",
      opportunityName: "Pyrolysis Line A",
      status: {
        kind: "reply_needed",
        days: 2,
        ask: "Can you send the revised price by Friday?",
      },
    });

    assert.equal(draft.subject, "Re: Pilot plant offer");
    assert.match(draft.bodyHtml, /Hi Simen,/);
    assert.match(draft.bodyHtml, /regarding Pyrolysis Line A/);
    assert.match(
      draft.bodyHtml,
      /Following up on your question — “Can you send the revised price by Friday\?”:/,
    );
    assert.match(draft.objective, /Answer Simen ask/);
  });

  it("frames a polite follow-up when waiting on the other side", () => {
    const draft = buildSmartMailReplyDraft({
      subject: "Re: Feedstock spec",
      bodyPreview: "Attached is the specification.",
      contactName: "Hanne",
      status: { kind: "waiting_on_them", days: 5 },
    });

    assert.equal(draft.subject, "Re: Feedstock spec");
    assert.match(draft.bodyHtml, /Hi Hanne,/);
    assert.match(draft.bodyHtml, /from 5 days ago/);
    assert.match(draft.bodyHtml, /about Feedstock spec/);
  });

  it("never invents a contact name when unknown or only an email is present", () => {
    const draft = buildSmartMailReplyDraft({
      subject: "General inquiry",
      bodyPreview: null,
      contactName: "buyer@example.com",
    });

    assert.equal( replySubject("Re: General inquiry"), "Re: General inquiry");
    assert.match(draft.bodyHtml, /<p>Hi,<\/p>/);
    assert.doesNotMatch(draft.bodyHtml, /blockquote/);
  });
});
