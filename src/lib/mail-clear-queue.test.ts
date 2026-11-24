import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildMailClearQueue, MAIL_CLEAR_QUEUE_CAP } from "./mail-clear-queue";
import { groupMailIntoThreads, type MailTriageMessage } from "./mail-triage";

const NOW = new Date("2026-10-28T12:00:00Z");

type Msg = MailTriageMessage & {
  contactName?: string | null;
  companyName?: string | null;
  contactEmails?: string[];
};

function mail(
  id: string,
  over: Partial<Msg> & Pick<Msg, "sentAt" | "conversationId">,
): Msg {
  return {
    subject: "Partnership",
    bodyPreview: "",
    senderEmail: "simen@mepex.no",
    isOutbound: false,
    contactName: "Simen",
    companyName: "Mepex",
    ...over,
    id,
  };
}

function queue(messages: Msg[]) {
  return buildMailClearQueue(groupMailIntoThreads(messages, NOW), NOW);
}

describe("buildMailClearQueue", () => {
  it("puts delivery failures first", () => {
    const items = queue([
      mail("ask", {
        conversationId: "c-ask",
        sentAt: "2026-10-20T09:00:00Z",
        bodyPreview: "Can you send a quote for biochar?",
      }),
      mail("out", {
        conversationId: "c-bounce",
        sentAt: "2026-10-28T08:00:00Z",
        isOutbound: true,
        senderEmail: "mats@standard.bio",
      }),
      mail("bounce", {
        conversationId: "c-bounce",
        sentAt: "2026-10-28T08:01:00Z",
        subject: "Undeliverable: Partnership",
        senderEmail: "microsoftexchange1@standard.bio",
        bodyPreview: "Failed: simen@mepex.nosimen",
      }),
    ]);
    assert.ok(items.length >= 2);
    assert.equal(items[0]!.kind, "delivery_failed");
    assert.equal(items[0]!.priority, 1);
    assert.equal(items[0]!.conversationId, "c-bounce");
  });

  it("flags we-owe when the client asked and we have not answered", () => {
    const items = queue([
      mail("m1", {
        conversationId: "c1",
        sentAt: "2026-10-20T09:00:00Z",
        bodyPreview: "Hi, can you send us a quote for biochar?",
      }),
    ]);
    assert.equal(items.length, 1);
    assert.equal(items[0]!.kind, "we_owe");
    assert.equal(items[0]!.priority, 2);
    assert.equal(items[0]!.primaryAction, "reply");
    assert.match(items[0]!.impact, /asked|stalls/i);
  });

  it("drops the ask once we replied (auto-drop)", () => {
    const items = queue([
      mail("m1", {
        conversationId: "c1",
        sentAt: "2026-10-27T09:00:00Z",
        bodyPreview: "Can you send a quote?",
      }),
      mail("m2", {
        conversationId: "c1",
        sentAt: "2026-10-28T08:00:00Z",
        isOutbound: true,
        senderEmail: "mats@standard.bio",
        bodyPreview: "Thanks, here you go.",
      }),
    ]);
    assert.equal(
      items.filter((item) => item.kind === "we_owe").length,
      0,
      "answered ask must leave the queue",
    );
    assert.equal(items.length, 0, "fresh outbound reply is not yet waiting_on_them");
  });

  it("queues waiting_on_them after the wait window", () => {
    const items = queue([
      mail("m1", {
        conversationId: "c1",
        sentAt: "2026-10-20T09:00:00Z",
        isOutbound: true,
        senderEmail: "mats@standard.bio",
        bodyPreview: "Please confirm the delivery address.",
      }),
    ]);
    assert.equal(items.length, 1);
    assert.equal(items[0]!.kind, "waiting_on_them");
    assert.equal(items[0]!.priority, 4);
    assert.equal(items[0]!.primaryAction, "follow_up");
  });

  it("surfaces an open promise when triage is still quiet (priority 3)", () => {
    const items = queue([
      mail("m1", {
        conversationId: "c1",
        sentAt: "2026-10-27T09:00:00Z",
        isOutbound: true,
        senderEmail: "mats@standard.bio",
        bodyPreview: "Thanks — we will send the quote tomorrow.",
      }),
    ]);
    assert.equal(items.length, 1);
    assert.equal(items[0]!.kind, "we_owe");
    assert.equal(items[0]!.priority, 3);
    assert.match(items[0]!.title, /promised/i);
  });

  it("stays quiet after handledAt until something newer arrives", () => {
    const items = queue([
      mail("m1", {
        conversationId: "c1",
        sentAt: "2026-10-20T09:00:00Z",
        bodyPreview: "Can you send a quote?",
        handledAt: "2026-10-21T10:00:00Z",
      }),
    ]);
    assert.equal(items.length, 0);
  });

  it("excludes machine-only meeting notices", () => {
    const items = queue([
      mail("m1", {
        conversationId: "c1",
        sentAt: "2026-10-28T09:00:00Z",
        subject: "Accepted: Kickoff",
        senderEmail: "simen@mepex.no",
      }),
    ]);
    assert.equal(items.length, 0);
  });

  it("offers resend when the bounce address was corrected", () => {
    const items = queue([
      mail("out", {
        conversationId: "c1",
        sentAt: "2026-10-28T08:00:00Z",
        isOutbound: true,
        senderEmail: "mats@standard.bio",
        contactEmails: ["simen@mepex.no"],
      }),
      mail("bounce", {
        conversationId: "c1",
        sentAt: "2026-10-28T08:01:00Z",
        subject: "Undeliverable: Partnership",
        senderEmail: "microsoftexchange1@standard.bio",
        bodyPreview: "Failed: simen@mepex.nosimen",
        contactEmails: ["simen@mepex.no"],
      }),
    ]);
    assert.equal(items.length, 1);
    assert.equal(items[0]!.primaryAction, "resend");
  });

  it("sorts older items first within the same priority", () => {
    const items = queue([
      mail("new", {
        conversationId: "c-new",
        sentAt: "2026-10-27T09:00:00Z",
        bodyPreview: "Could you send the proposal today?",
      }),
      mail("old", {
        conversationId: "c-old",
        sentAt: "2026-10-20T09:00:00Z",
        bodyPreview: "Can you send us a quote for biochar?",
      }),
    ]);
    assert.equal(items.length, 2);
    assert.equal(items[0]!.conversationId, "c-old");
    assert.equal(items[1]!.conversationId, "c-new");
  });

  it("caps the queue", () => {
    const messages: Msg[] = [];
    for (let i = 0; i < MAIL_CLEAR_QUEUE_CAP + 5; i += 1) {
      messages.push(
        mail(`m${i}`, {
          conversationId: `c${i}`,
          sentAt: `2026-10-${String(10 + (i % 18)).padStart(2, "0")}T09:00:00Z`,
          bodyPreview: "Can you send a quote for biochar?",
        }),
      );
    }
    const items = queue(messages);
    assert.equal(items.length, MAIL_CLEAR_QUEUE_CAP);
  });
});
