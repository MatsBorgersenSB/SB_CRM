import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildInboundMailAttention,
  inboundMailIssueHref,
  mergeInboundMailIntoCorrespondence,
} from "./inbound-mail-attention";
import { resolveAttentionActions } from "./attention-action-resolver";
import { attentionIssueHref } from "@/types/attention-item";
import { EMPTY_CORRESPONDENCE } from "./company-correspondence";
import type { Company } from "@/types/company";
import type { Contact } from "@/types/contact";

function company(partial: Partial<Company> = {}): Company {
  return {
    id: 1,
    Title: "Hornindal",
    CompanyID: "CO-HORN",
    code: "CO-HORN",
    ParentCompany: null,
    Domain: "",
    Industry: "Waste Management",
    Status: "Active",
    CompanyTypes: ["Customer"],
    AccountOwner: { Id: 1, Title: "Mats Borgersen" },
    Phone: "",
    Email: "",
    AddressLine1: "",
    AddressLine2: "",
    PostalCode: "",
    City: "",
    Country: null,
    pipelineIds: [],
    contacts: [
      {
        id: 1,
        ContactID: "CT-JOSTEIN",
        Title: "Jostein Smemo",
        FirstName: "Jostein",
        LastName: "Smemo",
        Email: "jostein@example.invalid",
        Company: { Id: 1, Title: "Hornindal" },
        JobTitle: "",
        Role: "Other",
        Phone: "",
        Mobile: "",
        LinkedInURL: "",
        Status: "Active",
        RelationshipLevel: "Operational",
      } satisfies Contact,
    ],
    ...partial,
  };
}

describe("inbound mail attention", () => {
  it("surfaces today's linked mail as urgent work", () => {
    const items = buildInboundMailAttention(
      [
        {
          id: "mail-1",
          subject: "Sv: Hornindal - G10 Tarkett flis",
          senderEmail: "jostein@example.invalid",
          sentAt: new Date().toISOString(),
          companyId: "CO-HORN",
          companyName: "Hornindal",
          contactId: "CT-JOSTEIN",
        },
      ],
      [company()],
    );

    assert.equal(items.length, 1);
    assert.equal(items[0]?.ruleId, "recent_inbound_mail");
    assert.equal(items[0]?.severity, "urgent");
    assert.match(items[0]?.recommendation ?? "", /Jostein Smemo/);
    assert.match(items[0]?.recommendation ?? "", /G10 Tarkett flis/);
    assert.equal(items[0]?.suggestedAiAction, "Read and decide next step");
    assert.match(items[0]?.issueHref ?? "", /[?&]mail=/);
    assert.equal(attentionIssueHref(items[0]!), items[0]?.issueHref);
    const actions = resolveAttentionActions(items[0]!);
    assert.equal(actions[0]?.label, "Open mail");
    assert.equal(actions[0]?.href, items[0]?.issueHref);
  });

  it("opens stored Outlook webLink as the issue", () => {
    const href = inboundMailIssueHref(
      {
        id: "mail-1",
        webLink: "https://outlook.office.com/mail/id/abc",
        externalMessageId: "AAMk",
      },
      "CO-HORN",
    );
    assert.equal(href, "https://outlook.office.com/mail/id/abc");
  });

  it("does not invent a company for unlinked mail", () => {
    const items = buildInboundMailAttention(
      [
        {
          id: "mail-2",
          subject: "Hello",
          senderEmail: "unknown@example.invalid",
          sentAt: new Date().toISOString(),
          companyId: "CO-MISSING",
          companyName: "Missing",
        },
      ],
      [company()],
    );
    assert.equal(items.length, 0);
  });

  it("treats inbound mail as correspondence so silence nags stay honest", () => {
    const merged = mergeInboundMailIntoCorrespondence(undefined, [
      {
        id: "mail-1",
        subject: "G30 Tarkett",
        senderEmail: "jostein.smemo@allskog.no",
        sentAt: "2026-10-15T11:04:00.000Z",
        companyId: "CO-HORN",
        companyName: "Hornindal",
        contactId: "CT-JOSTEIN",
      },
    ]);
    const evidence = merged.get("CO-HORN") ?? EMPTY_CORRESPONDENCE;
    assert.ok(evidence.messageCount > 0);
    assert.equal(evidence.lastSentAt, "2026-10-15T11:04:00.000Z");
    assert.ok(evidence.correspondentEmails.includes("jostein.smemo@allskog.no"));
  });
});
