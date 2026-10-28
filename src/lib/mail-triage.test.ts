import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bouncedSubject,
  classifyMailMessage,
  countMailViews,
  describeMailThreadStatus,
  failedRecipientFromBounce,
  groupMailIntoThreads,
  leadMessageOf,
  triageMailThread,
  type MailTriageMessage,
} from "./mail-triage";

const NOW = new Date("2026-10-28T12:00:00Z");

function mail(
  id: string,
  over: Partial<MailTriageMessage> & Pick<MailTriageMessage, "sentAt">,
): MailTriageMessage {
  return {
    conversationId: "c1",
    subject: "Partnership",
    bodyPreview: "",
    senderEmail: "simen@mepex.no",
    isOutbound: false,
    ...over,
    id,
  };
}

describe("classifyMailMessage", () => {
  it("recognises Norwegian and English calendar responses", () => {
    assert.equal(
      classifyMailMessage({ subject: "Godtatt: Møte", senderEmail: "a@b.no" }),
      "meeting_notice",
    );
    assert.equal(
      classifyMailMessage({ subject: "Accepted: Meeting", senderEmail: "a@b.no" }),
      "meeting_notice",
    );
  });

  it("recognises Exchange bounces by subject or sender", () => {
    assert.equal(
      classifyMailMessage({ subject: "Undeliverable: Hello", senderEmail: "x@y.no" }),
      "delivery_failure",
    );
    assert.equal(
      classifyMailMessage({
        subject: "Hello",
        senderEmail: "microsoftexchange329e71@standard.bio",
      }),
      "delivery_failure",
    );
  });

  it("treats ordinary correspondence as human", () => {
    assert.equal(
      classifyMailMessage({ subject: "Re: Innovasjonspartnerskap", senderEmail: "jarle@mepex.no" }),
      "human",
    );
  });
});

describe("failedRecipientFromBounce", () => {
  it("names the address the bounce says failed, not our own", () => {
    const address = failedRecipientFromBounce({
      subject: "Undeliverable: Follow-up",
      senderEmail: "microsoftexchange329e71@standard.bio",
      bodyPreview:
        "Delivery has failed to these recipients or groups: Simen Randby (simen@mepex.nosimen) Your message couldn't be delivered. From mats.borgersen@standard.bio",
    });
    assert.equal(address, "simen@mepex.nosimen");
  });

  it("returns null rather than guessing", () => {
    assert.equal(
      failedRecipientFromBounce({
        subject: "Undeliverable",
        senderEmail: "postmaster@x.no",
        bodyPreview: "Your message could not be delivered.",
      }),
      null,
    );
  });
});

describe("triageMailThread", () => {
  it("flags a bounce nothing human followed", () => {
    const status = triageMailThread(
      [
        mail("1", { sentAt: "2026-10-28T08:00:00Z", isOutbound: true, senderEmail: "mats@standard.bio" }),
        mail("2", {
          sentAt: "2026-10-28T08:01:00Z",
          subject: "Undeliverable: Partnership",
          senderEmail: "microsoftexchange1@standard.bio",
          bodyPreview: "Failed: simen@mepex.nosimen",
        }),
      ],
      NOW,
    );
    assert.equal(status.kind, "delivery_failed");
    assert.equal(
      status.kind === "delivery_failed" ? status.failedAddress : null,
      "simen@mepex.nosimen",
    );
  });

  it("clears the bounce once a person writes afterwards", () => {
    const status = triageMailThread(
      [
        mail("1", {
          sentAt: "2026-10-27T08:01:00Z",
          subject: "Undeliverable: Partnership",
          senderEmail: "microsoftexchange1@standard.bio",
        }),
        mail("2", { sentAt: "2026-10-28T09:00:00Z", bodyPreview: "Thanks, all good." }),
      ],
      NOW,
    );
    assert.equal(status.kind, "none");
  });

  const bounced = (contactEmails: string[]) => [
    mail("1", {
      sentAt: "2026-10-28T08:00:00Z",
      isOutbound: true,
      senderEmail: "mats@standard.bio",
      contactEmails,
    }),
    mail("2", {
      sentAt: "2026-10-28T08:01:00Z",
      subject: "Undeliverable: Partnership",
      senderEmail: "microsoftexchange1@standard.bio",
      bodyPreview: "Failed: simen@mepex.nosimen",
      contactEmails,
    }),
  ];

  it("knows the address was corrected on the contact but the mail was not resent", () => {
    const status = triageMailThread(bounced(["simen@mepex.no"]), NOW);
    assert.equal(status.kind, "delivery_failed");
    assert.equal(status.kind === "delivery_failed" && status.addressCorrected, true);
  });

  it("keeps the plain failure while the contact still carries the bad address", () => {
    const status = triageMailThread(bounced(["simen@mepex.nosimen"]), NOW);
    assert.equal(status.kind === "delivery_failed" && status.addressCorrected, false);
  });

  it("clears a corrected bounce once mail has gone to the new address elsewhere", () => {
    const thread = bounced(["simen@mepex.no"]);
    const resend = mail("3", {
      conversationId: "c2",
      sentAt: "2026-10-28T10:00:00Z",
      isOutbound: true,
      senderEmail: "mats@standard.bio",
      recipientEmails: ["simen@mepex.no"],
    });
    assert.equal(triageMailThread(thread, NOW, [...thread, resend]).kind, "none");
  });

  it("asks for a reply only when the last inbound mail asks for something", () => {
    const asked = triageMailThread(
      [mail("1", { sentAt: "2026-10-26T09:00:00Z", bodyPreview: "Can you send the quote by Friday?" })],
      NOW,
    );
    assert.equal(asked.kind, "reply_needed");
    const receipt = triageMailThread(
      [mail("2", { sentAt: "2026-10-26T09:00:00Z", subject: "Takk for bestillingen!", bodyPreview: "Ordre mottatt." })],
      NOW,
    );
    assert.equal(receipt.kind, "none");
  });

  it("notes silence only after the follow-up window", () => {
    const fresh = triageMailThread(
      [mail("1", { sentAt: "2026-10-27T09:00:00Z", isOutbound: true })],
      NOW,
    );
    assert.equal(fresh.kind, "none");
    const quiet = triageMailThread(
      [mail("2", { sentAt: "2026-10-22T09:00:00Z", isOutbound: true })],
      NOW,
    );
    assert.equal(quiet.kind, "waiting_on_them");
  });

  it("marks calendar-only conversations as meeting responses", () => {
    const status = triageMailThread(
      [mail("1", { sentAt: "2026-10-28T09:00:00Z", subject: "Godtatt: Møte" })],
      NOW,
    );
    assert.equal(status.kind, "meeting_notice");
  });
});

describe("describeMailThreadStatus", () => {
  it("always gives an impact for a status it shows", () => {
    for (const status of [
      {
        kind: "delivery_failed",
        failedAddress: null,
        sentAt: "2026-10-28T00:00:00Z",
        addressCorrected: false,
        bouncedMail: "mail",
        originalSubject: null,
      },
      {
        kind: "delivery_failed",
        failedAddress: "a@b.no",
        sentAt: "2026-10-28T00:00:00Z",
        addressCorrected: true,
        bouncedMail: "mail",
        originalSubject: "Quote",
      },
      {
        kind: "delivery_failed",
        failedAddress: "a@b.no",
        sentAt: "2026-10-28T00:00:00Z",
        addressCorrected: false,
        bouncedMail: "calendar",
        originalSubject: "Godtatt: Møte",
      },
      { kind: "reply_needed", days: 2, ask: null },
      { kind: "waiting_on_them", days: 4 },
      { kind: "meeting_notice" },
    ] as const) {
      const copy = describeMailThreadStatus(status, "Simen Randby");
      assert.ok(copy && copy.impact.length > 0);
    }
    assert.equal(describeMailThreadStatus({ kind: "none" }, null), null);
  });
});

describe("threads and views", () => {
  it("collapses a back-and-forth into one conversation and leads with real mail", () => {
    const threads = groupMailIntoThreads(
      [
        mail("1", { sentAt: "2026-10-27T09:00:00Z", subject: "Re: Partnership" }),
        mail("2", { sentAt: "2026-10-28T09:00:00Z", subject: "Godtatt: Partnership" }),
      ],
      NOW,
    );
    assert.equal(threads.length, 1);
    assert.equal(leadMessageOf(threads[0]!.messages)?.id, "1");
  });

  it("counts work-link and system views honestly", () => {
    const threads = groupMailIntoThreads(
      [
        mail("1", { conversationId: "a", sentAt: "2026-10-26T09:00:00Z", bodyPreview: "Please send the quote." }),
        mail("2", { conversationId: "b", sentAt: "2026-10-28T09:00:00Z", subject: "Godtatt: Møte" }),
      ],
      NOW,
    );
    const counts = countMailViews(threads);
    assert.equal(counts.all, 1);
    assert.equal(counts.needs_you, 1);
    assert.equal(counts.unlinked, 1);
    assert.equal(counts.system, 1);
  });
});

describe("automatic mail and dismissals", () => {
  it("does not treat order confirmations or machine mailboxes as a person's ask", () => {
    assert.equal(
      classifyMailMessage({
        subject: "Ordrebekreftelse 12345",
        senderEmail: "kunde.no@ifm.com",
        bodyPreview: "Please confirm the delivery date.",
      }),
      "automatic",
    );
    assert.equal(
      classifyMailMessage({
        subject: "Your Microsoft security code",
        senderEmail: "account-security@x.com",
      }),
      "automatic",
    );
    assert.equal(
      classifyMailMessage({
        subject: "Quote",
        senderEmail: "jarle@mepex.no",
        bodyPreview: "Please do not reply to this email.",
      }),
      "automatic",
    );
    assert.equal(
      triageMailThread(
        [
          mail("1", {
            sentAt: "2026-10-26T09:00:00Z",
            subject: "Order confirmation",
            senderEmail: "orders@shop.no",
            bodyPreview: "Please confirm.",
          }),
        ],
        NOW,
      ).kind,
      "none",
    );
  });

  it("stays quiet after no-reply-needed until a newer mail arrives", () => {
    const ask = mail("1", {
      sentAt: "2026-10-26T09:00:00Z",
      bodyPreview: "Please send the quote.",
      handledAt: "2026-10-27T09:00:00Z",
    });
    assert.equal(triageMailThread([ask], NOW).kind, "none");
    const newer = mail("2", {
      sentAt: "2026-10-28T09:00:00Z",
      bodyPreview: "Can you send the quote today?",
      handledAt: "2026-10-27T09:00:00Z",
    });
    assert.equal(triageMailThread([ask, newer], NOW).kind, "reply_needed");
  });

  it("knows when only a meeting reply bounced and drops the Postmaster prefix", () => {
    assert.equal(bouncedSubject("Undeliverable: Godtatt: Møte"), "Godtatt: Møte");
    assert.equal(bouncedSubject("Quote"), "Quote");
    const status = triageMailThread(
      [
        mail("1", {
          sentAt: "2026-10-28T09:00:00Z",
          subject: "Undeliverable: Godtatt: Møte",
          senderEmail: "postmaster@mepex.no",
          bodyPreview: "Delivery has failed to jarle@mepex.no",
        }),
      ],
      NOW,
    );
    assert.equal(status.kind === "delivery_failed" && status.bouncedMail, "calendar");
  });
});
