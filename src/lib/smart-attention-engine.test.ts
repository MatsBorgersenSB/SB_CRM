import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EMPTY_CORRESPONDENCE } from "./company-correspondence";
import {
  buildAttentionItems,
  buildCompanyAttentionItems,
  buildContactAttentionItems,
} from "./smart-attention-engine";
import type { Activity } from "@/types/activity";
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
    // Silent-contact attention is posture-aware — only sell-to companies are flagged.
    CompanyTypes: ["Prospect"],
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

describe("company attention — Outlook mail is a touchpoint", () => {
  it("does not claim no activity when Outlook mail already exists", () => {
    const person = contact({
      ContactID: "CT-JOSTEIN",
      FirstName: "Jostein",
      LastName: "Smemo",
      Email: "jostein.smemo@allskog.no",
    });
    const allskog = {
      ...companyWithContact(person),
      Title: "Allskog",
      CompanyID: "CO-1031",
      code: "CO-1031",
    };

    const items = buildCompanyAttentionItems(
      allskog,
      [],
      [],
      [],
      [allskog],
      {
        ...EMPTY_CORRESPONDENCE,
        messageCount: 2,
        lastSentAt: "2026-10-15T11:04:00.000Z",
        correspondentEmails: ["jostein.smemo@allskog.no"],
        lastSentByEmail: {
          "jostein.smemo@allskog.no": "2026-10-15T11:04:00.000Z",
        },
      },
    );

    assert.equal(
      items.some((item) => item.ruleId === "no_activity"),
      false,
      "Outlook mail is a recorded touch — do not say the relationship is silent",
    );
    assert.equal(
      items.some((item) => item.ruleId === "make_first_contact"),
      false,
      "Do not ask to make first contact after mail has already happened",
    );
  });
});

describe("attention owner / responsibility", () => {
  it("lists the company account owner on company and contact rows", () => {
    const person = contact({
      ContactID: "CT-JAN",
      FirstName: "Jan Kåre",
      LastName: "Pedersen",
      Email: "jan@example.invalid",
    });
    const biogy = {
      ...companyWithContact(person),
      Title: "BIOGY SOLUTIONS AS",
      CompanyID: "CO-BIOGY",
      code: "CO-BIOGY",
      AccountOwner: { Id: 1, Title: "Mats Borgersen" },
    };

    const items = buildAttentionItems({
      companies: [biogy],
      pipelines: [],
      activities: [],
      commercialPackages: [],
    });

    assert.ok(items.length > 0, "silent sell-to company should raise attention");
    for (const item of items) {
      assert.equal(item.ownerLabel, "Mats Borgersen");
    }
  });

  it("lists the activity assignee ahead of the company owner", () => {
    const person = contact({
      ContactID: "CT-RISE",
      FirstName: "Contact",
      LastName: "Rise",
      Email: "contact@example.invalid",
    });
    const rise = {
      ...companyWithContact(person),
      Title: "Rise PFI",
      CompanyID: "CO-RISE",
      code: "CO-RISE",
      AccountOwner: { Id: 1, Title: "Mats Borgersen" },
    };
    const overdue = {
      id: 9,
      ActivityID: "ACT-OVERDUE",
      ActivityType: "Task",
      ActivityDate: "2026-08-01T10:00:00.000Z",
      Subject: "Follow-up call",
      Summary: "Follow-up call",
      ActivityDescription: "",
      Company: { Id: rise.id, Title: rise.Title, CompanyID: rise.CompanyID },
      Contact: null,
      Deal: null,
      ActivityOwner: { Id: 101, Title: "Hugo Jansson" },
      ActionRequired: true,
      NextAction: "Schedule Follow-Up Call",
      NextActionDate: "2026-08-20",
      ActionStatus: "Not Started",
      ActionOutcome: "",
    } as unknown as Activity;

    const items = buildAttentionItems({
      companies: [rise],
      pipelines: [],
      activities: [overdue],
      commercialPackages: [],
    });
    const activityRow = items.find((item) => item.sourceObjectId === "ACT-OVERDUE");
    assert.equal(activityRow?.ownerLabel, "Hugo Jansson");
  });

  it("lists the contact owner ahead of the company account owner on contact rows", () => {
    const person = contact({
      ContactID: "CT-LARSEN",
      FirstName: "Sten",
      LastName: "Larsen",
      Email: "sten@example.invalid",
      ContactOwner: { Id: 100, Title: "Walter Aker" },
    });
    const eramet = {
      ...companyWithContact(person),
      Title: "Eramet",
      CompanyID: "CO-1015",
      code: "CO-1015",
      AccountOwner: { Id: 1, Title: "Mats Borgersen" },
    };

    const items = buildContactAttentionItems(
      person.ContactID,
      eramet.CompanyID,
      [eramet],
      [],
      [],
      [],
    );
    assert.ok(items.length > 0, "contact attention should exist");
    for (const item of items) {
      if (item.objectType === "Contact") {
        assert.equal(item.ownerLabel, "Walter Aker");
      }
    }
  });
});
