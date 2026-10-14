import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { composeCompanyWhatMatters } from "./company-what-matters";
import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";

const NOW = new Date("2026-10-14T12:00:00Z");

function isoDaysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 86_400_000).toISOString();
}

function company(overrides: Partial<Company> = {}): Company {
  return {
    Title: "Allskog",
    CompanyID: "C-1",
    Status: "Active",
    CompanyTypes: ["Prospect"],
    contacts: [],
    pipelineIds: [],
    ...overrides,
  } as unknown as Company;
}

function activity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 1,
    ActivityID: "ACT-1",
    ActivityType: "Email",
    ActivityDate: isoDaysAgo(3),
    Subject: "Intro",
    ActivityDescription: "",
    Company: { Id: 1, Title: "Allskog" },
    Contact: null,
    Deal: null,
    ActivityOwner: null,
    ActionRequired: false,
    NextAction: "",
    NextActionDate: "",
    ActionStatus: "Not Started",
    ActionOutcome: "",
    ...overrides,
  } as unknown as Activity;
}

function deal(overrides: Partial<PipelineRow> = {}): PipelineRow {
  return {
    id: "PL-1",
    assetName: "Trondheim biochar plant",
    status: "Proposal",
    salesValue: 1_000_000,
    currency: "EUR",
    probability: 40,
    ...overrides,
  } as unknown as PipelineRow;
}

describe("composeCompanyWhatMatters", () => {
  it("a supplier with nothing going on says nothing", () => {
    const result = composeCompanyWhatMatters({
      company: company({ CompanyTypes: ["Supplier / Vendor"] }),
      companyActivities: [],
      activities: [],
      openDeals: [],
      lastContactAt: null,
      now: NOW,
    });
    assert.equal(result, null);
  });

  it("a supplier with an overdue commitment still gets the commitment", () => {
    const overdue = activity({
      ActionRequired: true,
      NextAction: "Confirm delivery date",
      NextActionDate: isoDaysAgo(4),
    });
    const result = composeCompanyWhatMatters({
      company: company({ CompanyTypes: ["Supplier / Vendor"] }),
      companyActivities: [overdue],
      activities: [overdue],
      openDeals: [],
      lastContactAt: isoDaysAgo(10),
      now: NOW,
    });
    assert.equal(result?.ruleId, "overdue_followup");
    assert.match(result!.sentence, /Confirm delivery date/);
    assert.match(result!.sentence, /overdue/);
  });

  it("a prospect we never spoke to is pointed at a named person", () => {
    const result = composeCompanyWhatMatters({
      company: company({
        contacts: [
          { ContactID: "P-1", FirstName: "Jostein", LastName: "Smemo", Title: "Jostein Smemo", JobTitle: "Salgsdirektør" },
        ] as unknown as Company["contacts"],
      }),
      companyActivities: [],
      activities: [],
      openDeals: [],
      lastContactAt: null,
      now: NOW,
    });
    assert.equal(result?.ruleId, "no_activity");
    assert.match(result!.sentence, /Jostein Smemo \(Salgsdirektør\)/);
  });

  it("a competitor we never spoke to is left alone", () => {
    const result = composeCompanyWhatMatters({
      company: company({ CompanyTypes: ["Competitor"] }),
      companyActivities: [],
      activities: [],
      openDeals: [],
      lastContactAt: null,
      now: NOW,
    });
    assert.equal(result, null);
  });

  it("unclassified beats everything except commitments and stalled deals", () => {
    const result = composeCompanyWhatMatters({
      company: company({ CompanyTypes: [] }),
      companyActivities: [],
      activities: [],
      openDeals: [],
      lastContactAt: isoDaysAgo(2),
      now: NOW,
    });
    assert.equal(result?.ruleId, "classify_relationship");
  });

  it("a stalled opportunity names the deal and the silence", () => {
    const d = deal();
    const result = composeCompanyWhatMatters({
      company: company({ pipelineIds: [d.id] }),
      companyActivities: [],
      activities: [],
      openDeals: [d],
      lastContactAt: null,
      now: NOW,
    });
    assert.equal(result?.ruleId, "stalled_opportunity");
    assert.match(result!.sentence, /Trondheim biochar plant \(Proposal\) has no recorded activity/);
    assert.equal(result!.severity, "urgent");
  });

  it("a deal with no logged activity borrows the company's recent mail touch", () => {
    const d = deal();
    const result = composeCompanyWhatMatters({
      company: company({ pipelineIds: [d.id] }),
      companyActivities: [],
      activities: [],
      openDeals: [d],
      lastContactAt: isoDaysAgo(2),
      now: NOW,
    });
    assert.equal(result?.ruleId, "deal_active");
    assert.match(result!.sentence, /last touch 2 days ago/);
  });

  it("a company touched 29 days ago with an unlogged deal reads as quiet, not dead", () => {
    const d = deal();
    const result = composeCompanyWhatMatters({
      company: company({ pipelineIds: [d.id] }),
      companyActivities: [],
      activities: [],
      openDeals: [d],
      lastContactAt: isoDaysAgo(29),
      now: NOW,
    });
    assert.equal(result?.ruleId, "stalled_opportunity");
    assert.equal(result!.severity, "needs_attention");
    assert.match(result!.sentence, /has had no activity for 29 days/);
  });

  it("a moving deal reads as healthy, not as an alarm", () => {
    const d = deal();
    const touch = activity({ Deal: { Id: 1, Title: d.id }, ActivityDate: isoDaysAgo(5) });
    const result = composeCompanyWhatMatters({
      company: company({ pipelineIds: [d.id] }),
      companyActivities: [touch],
      activities: [touch],
      openDeals: [d],
      lastContactAt: isoDaysAgo(5),
      now: NOW,
    });
    assert.equal(result?.ruleId, "deal_active");
    assert.equal(result!.severity, "healthy");
    assert.match(result!.sentence, /last touch 5 days ago/);
  });

  it("a cooling customer with an open deal is urgent after 60 days", () => {
    const d = deal();
    const touch = activity({ Deal: { Id: 1, Title: d.id }, ActivityDate: isoDaysAgo(10) });
    const result = composeCompanyWhatMatters({
      company: company({ CompanyTypes: ["Customer"], pipelineIds: [d.id] }),
      companyActivities: [],
      activities: [touch],
      openDeals: [d],
      lastContactAt: isoDaysAgo(70),
      now: NOW,
    });
    assert.equal(result?.ruleId, "no_recent_contact");
    assert.equal(result!.severity, "urgent");
    assert.match(result!.sentence, /Last touch 70 days ago with Trondheim biochar plant open/);
  });
});
