import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EMPTY_CORRESPONDENCE } from "./company-correspondence";
import { buildContactAttentionItems } from "./smart-attention-engine";
import type { Company } from "@/types/company";
import type { Contact } from "@/types/contact";

function contact(partial: Partial<Contact> & Pick<Contact, "ContactID" | "Email">): Contact {
  return {
    id: 1,
    Title: `${partial.FirstName ?? "Håkon"} ${partial.LastName ?? "Rootwelt"}`.trim(),
    FirstName: "Håkon",
    LastName: "Rootwelt",
    Company: { Id: 1, Title: "ANTEC BIOGAS AS" },
    JobTitle: "Daglig leder",
    Role: "Other",
    Phone: "",
    Mobile: "",
    LinkedInURL: "",
    Status: "Active",
    RelationshipLevel: "Operational",
    ...partial,
  };
}

function companyWithContact(person: Contact): Company {
  return {
    id: 1,
    Title: "ANTEC BIOGAS AS",
    CompanyID: "CO-1014",
    code: "CO-1014",
    ParentCompany: null,
    Domain: "antecbiogas.no",
    Industry: "Waste Management",
    Status: "Active",
    AccountOwner: null,
    Phone: "",
    Email: "",
    AddressLine1: "",
    AddressLine2: "",
    PostalCode: "",
    City: "",
    Country: null,
    pipelineIds: [],
    contacts: [person],
  };
}

describe("contact attention — new person with company mail", () => {
  it("does not crash when mail exists but the contact has no CRM activity", () => {
    const person = contact({
      ContactID: "CT-48BDF4D3",
      Email: "haakon.nokhart@antecbiogas.no",
    });
    const items = buildContactAttentionItems(
      person.ContactID,
      "CO-1014",
      [companyWithContact(person)],
      [],
      [],
      [],
      {
        ...EMPTY_CORRESPONDENCE,
        messageCount: 12,
        lastSentAt: "2026-09-01T10:00:00.000Z",
        correspondentEmails: ["haakon.nokhart@antecbiogas.no"],
        lastSentByEmail: {
          "haakon.nokhart@antecbiogas.no": "2026-09-01T10:00:00.000Z",
        },
      },
    );

    assert.ok(Array.isArray(items));
    assert.equal(
      items.some((item) => item.ruleId === "no_activity"),
      false,
      "Outlook mail counts as last touch — do not treat as silent",
    );
  });

  it("still flags a silent contact when there is no mail and no activity", () => {
    const person = contact({
      ContactID: "CT-NEW",
      Email: "nobody@example.invalid",
    });
    const items = buildContactAttentionItems(
      person.ContactID,
      "CO-1014",
      [companyWithContact(person)],
      [],
      [],
      [],
      EMPTY_CORRESPONDENCE,
    );

    assert.equal(items.some((item) => item.ruleId === "no_activity"), true);
  });
});
