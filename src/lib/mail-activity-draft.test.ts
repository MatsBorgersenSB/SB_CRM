import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildMailActivityPreset } from "./mail-activity-draft";

const base = {
  lead: {
    id: "m1",
    conversationId: "c1",
    subject: "Re: Pilot plant offer",
    bodyPreview: "Can you send the revised price by Friday?",
    sentAt: "2026-10-27T09:00:00Z",
  },
  contactId: null,
  contactName: "Simen",
  companyId: null,
  companyCode: null,
  opportunityId: null,
  projectId: null,
  projectName: null,
  today: "2026-10-28",
};

describe("buildMailActivityPreset", () => {
  it("makes a reply task from the question the mail asked", () => {
    const preset = buildMailActivityPreset({
      ...base,
      status: { kind: "reply_needed", days: 1, ask: "Can you send the revised price by Friday?" },
    });
    assert.equal(preset.ActivityType, "Task");
    assert.equal(preset.Subject, "Reply to Simen: Pilot plant offer");
    assert.match(preset.ActivityDescription ?? "", /They asked: “Can you send/);
    assert.equal(preset.OutlookMessageId, "m1");
    assert.equal(preset.OutlookConversationId, "c1");
  });

  it("follows up when they have gone quiet and resends after a bounce", () => {
    assert.equal(
      buildMailActivityPreset({ ...base, status: { kind: "waiting_on_them", days: 5 } }).Subject,
      "Follow up: Pilot plant offer",
    );
    assert.equal(
      buildMailActivityPreset({
        ...base,
        status: { kind: "delivery_failed", failedAddress: null, sentAt: base.lead.sentAt, addressCorrected: true, bouncedMail: "mail", originalSubject: null },
      }).Subject,
      "Resend: Pilot plant offer",
    );
  });

  it("only links records the mail is already tied to", () => {
    const none = buildMailActivityPreset({ ...base, status: { kind: "none" } });
    assert.equal(none.Company, null);
    assert.equal(none.Contact, null);
    assert.equal(none.Deal, null);

    const linked = buildMailActivityPreset({
      ...base,
      status: { kind: "none" },
      companyCode: "CO-MEPEX",
      opportunityId: "deal-1",
    });
    assert.deepEqual(linked.Company, { CompanyID: "CO-MEPEX" });
    assert.deepEqual(linked.Deal, { DealID: "deal-1" });
  });

  it("sets ActivityOwner when delegating a mail directly to a colleague", () => {
    const delegated = buildMailActivityPreset({
      ...base,
      status: { kind: "reply_needed", days: 1, ask: "Can you send the revised price by Friday?" },
      assignee: { Id: 4, Title: "Ola" },
    });
    assert.deepEqual(delegated.ActivityOwner, { Id: 4, Title: "Ola" });
  });
});
