import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildGrowthSuperSkills } from "./growth-super-skills";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type { Activity } from "@/types/activity";
import type { SourceFinding } from "./source-findings";

function company(partial: Partial<Company> & Pick<Company, "CompanyID" | "Title">): Company {
  return {
    id: 1,
    ParentCompany: null,
    Domain: "",
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
    contacts: [],
    ...partial,
  } as Company;
}

function deal(partial: Partial<PipelineRow> & Pick<PipelineRow, "id" | "assetName">): PipelineRow {
  return {
    companyRole: "Technology Buyer",
    targetFeedstock: "manure",
    reactorDesignCapacity: 0,
    currentMilestone: "Prospecting",
    status: "Prospecting",
    salesValue: 0,
    currency: "EUR",
    probability: 10,
    ...partial,
  };
}

describe("growth super skills", () => {
  it("hears a live classified competitor on a customer deal and attaches internal knowledge", () => {
    const mavitec = company({
      CompanyID: "CO-1026",
      Title: "MAVITEC B.V.",
      CompanyTypes: ["Competitor"],
    });
    const customer = company({
      CompanyID: "CO-1",
      Title: "Nordic Heat",
      CompanyTypes: ["Customer"],
      pipelineIds: ["d1"],
    });
    const findings: Record<string, SourceFinding[]> = {
      "CO-1026": [
        {
          id: "f1",
          title: "what we know",
          addedAt: "2026-09-20T00:00:00.000Z",
          kind: "competitor",
          claims: [
            {
              id: "offer",
              statement: "They sell gasification equipment for manure.",
              impact: "Offer overlap.",
              decision: "confirmed",
            },
          ],
        },
      ],
    };

    const skills = buildGrowthSuperSkills({
      companies: [mavitec, customer],
      pipelines: [
        deal({
          id: "d1",
          assetName: "City plant — Mavitec also quoted",
          ClientLookup: "Nordic Heat",
        }),
      ],
      events: [],
      findingsByCompanyId: findings,
    });

    const hearing = skills.hearings.find((row) => row.dealId === "d1");
    assert.equal(hearing?.unknown, false);
    assert.equal(hearing?.mentions[0]?.competitorName, "MAVITEC B.V.");
    assert.match(hearing?.mentions[0]?.knownFact ?? "", /gasification/i);
  });

  it("proposes an existing offtaker instead of inventing one", () => {
    const buyer = company({
      CompanyID: "CO-2",
      Title: "Buyer AS",
      CompanyTypes: ["Customer"],
      Country: { Title: "Norway" } as Company["Country"],
      pipelineIds: ["d2"],
    });
    const offtaker = company({
      CompanyID: "CO-9",
      Title: "Nordic Offtake",
      CompanyTypes: ["Offtaker"],
      Country: { Title: "Norway" } as Company["Country"],
    });

    const skills = buildGrowthSuperSkills({
      companies: [buyer, offtaker],
      pipelines: [
        deal({
          id: "d2",
          assetName: "Coast plant",
          ClientLookup: "Buyer AS",
        }),
      ],
      events: [],
    });

    assert.ok(skills.realities[0]?.blockers.includes("offtake"));
    assert.equal(skills.ecosystemMatches[0]?.candidates[0]?.companyName, "Nordic Offtake");
  });

  it("asks to turn a meeting without captured knowledge into knowledge", () => {
    const buyer = company({
      CompanyID: "CO-3",
      Title: "Buyer AS",
      CompanyTypes: ["Customer"],
      pipelineIds: ["d3"],
    });
    const activity = {
      id: 1,
      ActivityID: "ACT-1",
      ActivityType: "Meeting",
      ActivityDate: new Date().toISOString(),
      Subject: "Permit workshop",
      ActivityDescription: "We talked about the permit.",
      Company: { Title: "Buyer AS" },
      Contact: null,
      Deal: { Title: "Coast plant" },
      ActivityOwner: null,
      ActionRequired: false,
      NextAction: "",
      NextActionDate: "",
      ActionStatus: "Completed",
      ActionOutcome: "Positive",
    } as Activity;

    const skills = buildGrowthSuperSkills({
      companies: [buyer],
      pipelines: [
        deal({
          id: "d3",
          assetName: "Coast plant",
          ClientLookup: "Buyer AS",
        }),
      ],
      events: [],
      activities: [activity],
      now: new Date(),
    });

    assert.equal(skills.meetingKnowledge[0]?.activityId, "ACT-1");
  });
});
