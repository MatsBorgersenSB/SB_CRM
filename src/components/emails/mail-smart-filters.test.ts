import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  filterAndSortMailMessages,
  filterAndSortMailThreads,
  type MailFilterableMessage,
  type MailFilterableThread,
  type MailSmartFilterState,
} from "./mail-smart-filters";

const baseState: MailSmartFilterState = {
  searchQuery: "",
  sentimentFilter: "all",
  directionFilter: "all",
  deletedFilter: "all",
  domainFilter: "external",
  dateSort: "desc",
};

const sampleMessages: MailFilterableMessage[] = [
  {
    id: "m1",
    subject: "Initial outreach",
    bodyPreview: "Hello Erik, let us discuss pyrolysis",
    senderEmail: "mats@standardbio.no",
    recipientEmails: ["erik@antec.no"],
    sentAt: "2026-08-19T15:39:00.000Z",
    sentiment: "neutral",
    isOutbound: true,
    isInternalOnly: false,
    isDeletedInSource: false,
    contactName: "Erik Rynning",
    opportunityName: "Antec - Honindal",
  },
  {
    id: "m2",
    subject: "Re: Initial outreach",
    bodyPreview: "Looks promising, send specification",
    senderEmail: "erik@antec.no",
    recipientEmails: ["mats@standardbio.no"],
    sentAt: "2026-09-21T08:11:00.000Z",
    sentiment: "positive",
    isOutbound: false,
    isInternalOnly: false,
    isDeletedInSource: false,
    contactName: "Erik Rynning",
    opportunityName: "Antec - Honindal",
  },
  {
    id: "m3",
    subject: "Internal prep notes",
    bodyPreview: "Team sync before call",
    senderEmail: "mats@standardbio.no",
    recipientEmails: ["bjorn@standardbio.no"],
    sentAt: "2026-09-10T10:00:00.000Z",
    sentiment: "neutral",
    isOutbound: true,
    isInternalOnly: true,
    isDeletedInSource: true,
  },
];

describe("mail-smart-filters", () => {
  it("sorts flat messages descending or ascending by date and applies SmartCRM filters", () => {
    const desc = filterAndSortMailMessages(sampleMessages, baseState);
    assert.deepEqual(desc.map((m) => m.id), ["m2", "m1"]);

    const asc = filterAndSortMailMessages(sampleMessages, {
      ...baseState,
      dateSort: "asc",
    });
    assert.deepEqual(asc.map((m) => m.id), ["m1", "m2"]);

    const internalDeleted = filterAndSortMailMessages(sampleMessages, {
      ...baseState,
      domainFilter: "internal_only",
      deletedFilter: "deleted",
    });
    assert.deepEqual(internalDeleted.map((m) => m.id), ["m3"]);
  });

  it("sorts threads and messages within threads ascending or descending by date", () => {
    const threads: MailFilterableThread<MailFilterableMessage>[] = [
      {
        conversationId: "c-older",
        summary: {
          subject: "Earlier thread",
          messageCount: 1,
          latestSentAt: "2026-08-01T12:00:00.000Z",
        },
        messages: [
          {
            ...sampleMessages[0]!,
            id: "m0",
            sentAt: "2026-08-01T12:00:00.000Z",
          },
        ],
      },
      {
        conversationId: "c-newer",
        summary: {
          subject: "Initial outreach",
          messageCount: 2,
          latestSentAt: "2026-09-21T08:11:00.000Z",
        },
        messages: [sampleMessages[0]!, sampleMessages[1]!],
      },
    ];

    const desc = filterAndSortMailThreads(threads, {
      ...baseState,
      dateSort: "desc",
    });
    assert.deepEqual(desc.map((t) => t.conversationId), ["c-newer", "c-older"]);
    assert.deepEqual(desc[0]!.messages.map((m) => m.id), ["m2", "m1"]);

    const asc = filterAndSortMailThreads(threads, {
      ...baseState,
      dateSort: "asc",
    });
    assert.deepEqual(asc.map((t) => t.conversationId), ["c-older", "c-newer"]);
    assert.deepEqual(asc[1]!.messages.map((m) => m.id), ["m1", "m2"]);
  });
});
