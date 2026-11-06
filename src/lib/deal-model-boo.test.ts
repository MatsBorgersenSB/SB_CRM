import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import { buildDealBrief, dealBriefApplies } from "./opportunity-deal-brief";
import {
  companyTypeForProjectOrganizationType,
  filterAvailableProjectCompanies,
  suggestProjectOrganizationType,
} from "./project-relationship-utils";
import { resolveSalesMotion, understandingFieldsForPipeline } from "./sales-motion";

const NOW = new Date("2026-11-04T12:00:00Z");

function deal(
  fields: Record<string, string> = {},
  extra: Record<string, unknown> = {},
): PipelineRow {
  return {
    id: "PL-1",
    assetName: "Antec Hornindal",
    offeringIds: [],
    team: [],
    salesValue: 0,
    currency: "EUR",
    reactorDesignCapacity: 0,
    targetFeedstock: "",
    understanding: { fields },
    ...extra,
  } as unknown as PipelineRow;
}

const plannedStep = {
  id: 2,
  ActivityID: "ACT-2",
  ActivityType: "Teams Meeting",
  ActivityDate: "2026-11-12T09:00:00Z",
  Subject: "Walkthrough with Antec",
  ActivityDescription: "",
  Company: null,
  Contact: { Title: "C-1" },
  Deal: { Title: "PL-1" },
  ActivityOwner: null,
  ActionRequired: false,
  NextAction: "",
  NextActionDate: "",
  ActionStatus: "Planned",
  ActionOutcome: "",
} as unknown as Activity;

const CUSTOMER_LAYER = {
  customer_problem: "Digestate disposal cost and limits on spreading",
  why_now: "New nutrient rules",
  decision_maker: "Plant owner",
};
const INPUTS = {
  offtake_strategy: "Surplus thermal heat (~7–8 GWh/yr) sold to Vest Biogas",
  end_product: "Biochar offtake secured with industrial buyer and carbon credit registry",
  feedstock_agreement: "Wood chips supply secured by Standard Bio (10-year term)",
  site_readiness: "Lease option signed for the plot next to the biogas plant",
  utilities: "Heat exchange tie-in, power and water capacity confirmed and agreed",
};

const boo = (fields: Record<string, string>, extra: Record<string, unknown> = {}) =>
  deal(fields, { dealModel: "boo", ...extra });

describe("deal model resolution (FS-005B 4.1)", () => {
  it("lets the user's choice win, even with no offerings", () => {
    const resolved = resolveSalesMotion(boo({}));
    assert.equal(resolved.motion, "boo");
    assert.equal(resolved.source, "chosen");
  });

  it("never guesses Build-Own-Operate from offerings", () => {
    const guessed = resolveSalesMotion({ offeringIds: ["prod-pyrolysis-reactor"] });
    assert.equal(guessed.source, "offerings");
    assert.notEqual(guessed.motion, "boo");
  });

  it("stays unclassified without a choice or offerings", () => {
    const none = resolveSalesMotion({ offeringIds: [] });
    assert.equal(none.motion, null);
    assert.equal(none.source, "none");
  });

  it("ignores an unknown stored value", () => {
    const resolved = resolveSalesMotion({
      offeringIds: [],
      dealModel: "nonsense" as never,
    });
    assert.equal(resolved.motion, null);
  });
});

describe("Build-Own-Operate understanding fields (FS-005B 5)", () => {
  const ids = (pipeline: Pick<PipelineRow, "offeringIds" | "dealModel">) =>
    understandingFieldsForPipeline(pipeline).map((field) => field.id);

  it("drops customer-problem/budget/economic buyer and leads with the 7 development pillars", () => {
    const list = ids(boo({}));
    assert.ok(!list.includes("budget"));
    assert.ok(!list.includes("economic_buyer"));
    assert.ok(!list.includes("customer_problem"));
    assert.ok(!list.includes("customer_vision"));
    assert.ok(!list.includes("customer_value"));
    assert.deepEqual(list.slice(0, 7), [
      "site_readiness",
      "feedstock_agreement",
      "utilities",
      "offtake_strategy",
      "end_product",
      "public_funding",
      "permitting",
    ]);
  });

  it("rewords shared fields for our own project development (FEL 1 → Realisation)", () => {
    const fields = understandingFieldsForPipeline(boo({}));
    const site = fields.find((field) => field.id === "site_readiness");
    assert.equal(site?.label, "Secure land plot");
    const feedstock = fields.find((field) => field.id === "feedstock_agreement");
    assert.equal(feedstock?.label, "Secure feedstock");
    const utilities = fields.find((field) => field.id === "utilities");
    assert.equal(utilities?.label, "Secure required utilities");
    const energy = fields.find((field) => field.id === "offtake_strategy");
    assert.equal(energy?.label, "Secure energy offtake");
    const biochar = fields.find((field) => field.id === "end_product");
    assert.equal(biochar?.label, "Secure product offtake (biochar)");
    const subsidies = fields.find((field) => field.id === "public_funding");
    assert.equal(subsidies?.label, "Secure subsidies (if we qualify)");
    const permitting = fields.find((field) => field.id === "permitting");
    assert.equal(permitting?.label, "Secure permitting");
    const decider = fields.find((field) => field.id === "decision_maker");
    assert.equal(decider?.label, "Who signs the agreements");
  });

  it("leaves Sell the system and unclassified deals without Build-Own-Operate fields", () => {
    for (const pipeline of [
      { offeringIds: ["prod-pyrolysis-reactor"] },
      { offeringIds: [] },
      { offeringIds: [], dealModel: "system" as const },
    ]) {
      const list = ids(pipeline);
      assert.ok(!list.includes("feedstock_agreement"));
      assert.ok(!list.includes("public_funding"));
      assert.ok(list.includes("budget"));
    }
    assert.equal(ids({ offeringIds: [], dealModel: "system" }).length, 20);
  });

  it("keeps captured answers when the model changes", () => {
    const answers = { ...CUSTOMER_LAYER, ...INPUTS, budget: "EUR 4.5m" };
    const asBoo = boo(answers);
    const asSale = deal(answers, { dealModel: "system" });
    assert.equal(asBoo.understanding?.fields?.feedstock_agreement, INPUTS.feedstock_agreement);
    assert.equal(asSale.understanding?.fields?.feedstock_agreement, INPUTS.feedstock_agreement);
    assert.ok(!understandingFieldsForPipeline(asSale).some((f) => f.id === "feedstock_agreement"));
  });
});

describe("Build-Own-Operate Brief (FS-005B 6)", () => {
  it("applies and uses Project development (FEL 1 → Realisation) column headings", () => {
    assert.equal(dealBriefApplies(boo({})), true);
    const brief = buildDealBrief({ pipeline: boo({}), activities: [], now: NOW });
    assert.equal(brief.columns.want, "Project development (FEL 1 → Realisation)");
    assert.equal(brief.columns.blocker, "What is blocking the plant");
    assert.equal(brief.verdict.id, "not_understood");
  });

  it("keeps customer wording for Sell the system", () => {
    const brief = buildDealBrief({ pipeline: deal({}), activities: [], now: NOW });
    assert.equal(brief.columns.want, "What the customer wants");
  });

  it("checks development pillars in FEL 1 → Realisation order: land plot → feedstock → utilities → energy offtake → biochar offtake", () => {
    const step1 = buildDealBrief({
      pipeline: boo({ site_readiness: "Plot identified; lease terms to be determined" }),
      activities: [plannedStep],
      now: NOW,
    });
    assert.equal(step1.verdict.id, "needs_attention");
    assert.equal(step1.weakestLink, "site_control");
    assert.equal(step1.blocker.fieldId, "site_readiness");
    assert.equal(step1.blocker.state, "assumed");

    const step2 = buildDealBrief({
      pipeline: boo({ site_readiness: INPUTS.site_readiness }),
      activities: [plannedStep],
      now: NOW,
    });
    assert.equal(step2.verdict.id, "needs_attention");
    assert.equal(step2.weakestLink, "feedstock_agreement");
    assert.match(step2.verdict.impact, /no plant to finance/);
    assert.equal(step2.blocker.fieldId, "feedstock_agreement");

    const step3 = buildDealBrief({
      pipeline: boo({
        site_readiness: INPUTS.site_readiness,
        feedstock_agreement: INPUTS.feedstock_agreement,
      }),
      activities: [plannedStep],
      now: NOW,
    });
    assert.equal(step3.verdict.id, "needs_attention");
    assert.equal(step3.weakestLink, "utilities");
    assert.equal(step3.blocker.fieldId, "utilities");

    const step4 = buildDealBrief({
      pipeline: boo({
        site_readiness: INPUTS.site_readiness,
        feedstock_agreement: INPUTS.feedstock_agreement,
        utilities: INPUTS.utilities,
      }),
      activities: [plannedStep],
      now: NOW,
    });
    assert.equal(step4.verdict.id, "needs_attention");
    assert.equal(step4.weakestLink, "offtake");
    assert.equal(step4.blocker.fieldId, "offtake_strategy");

    const step5 = buildDealBrief({
      pipeline: boo({
        site_readiness: INPUTS.site_readiness,
        feedstock_agreement: INPUTS.feedstock_agreement,
        utilities: INPUTS.utilities,
        offtake_strategy: INPUTS.offtake_strategy,
      }),
      activities: [plannedStep],
      now: NOW,
    });
    assert.equal(step5.verdict.id, "needs_attention");
    assert.equal(step5.weakestLink, "biochar_offtake");
    assert.equal(step5.blocker.fieldId, "end_product");
  });

  it("is a Clear path once core inputs are secured, and points at subsidies, permits and funding", () => {
    const brief = buildDealBrief({
      pipeline: boo({ ...CUSTOMER_LAYER, ...INPUTS }),
      activities: [plannedStep],
      now: NOW,
    });
    assert.equal(brief.verdict.id, "clear_path");
    assert.match(brief.verdict.impact, /permits and funding/);
    assert.equal(brief.blocker.fieldId, "public_funding");
    assert.equal(brief.next.fieldId, "public_funding");
  });

  it("does not let permits or funding change the verdict before the negotiation stage", () => {
    for (const stage of ["discovery", undefined]) {
      const brief = buildDealBrief({
        pipeline: boo({ ...CUSTOMER_LAYER, ...INPUTS }, { salesStageId: stage }),
        activities: [plannedStep],
        now: NOW,
      });
      assert.equal(brief.verdict.id, "clear_path");
    }
  });

  it("gates on subsidies, permits and funding from the negotiation stage onward", () => {
    const base = { ...CUSTOMER_LAYER, ...INPUTS };
    const open = buildDealBrief({
      pipeline: boo(base, { salesStageId: "negotiation" }),
      activities: [plannedStep],
      now: NOW,
    });
    assert.equal(open.verdict.id, "needs_attention");
    assert.equal(open.weakestLink, "public_funding");

    const withSubsidies = buildDealBrief({
      pipeline: boo({ ...base, public_funding: "Enova grant awarded" }, { salesStageId: "negotiation" }),
      activities: [plannedStep],
      now: NOW,
    });
    assert.equal(withSubsidies.weakestLink, "permitting");
    assert.equal(withSubsidies.verdict.id, "needs_attention");

    const partly = buildDealBrief({
      pipeline: boo(
        { ...base, public_funding: "Enova grant awarded", permitting: "Permit granted" },
        { salesStageId: "negotiation" },
      ),
      activities: [plannedStep],
      now: NOW,
    });
    assert.equal(partly.weakestLink, "funding");
    assert.equal(partly.verdict.id, "needs_attention");

    const done = buildDealBrief({
      pipeline: boo(
        {
          ...base,
          permitting: "Permit granted",
          funding_source: "Project finance term sheet signed",
          public_funding: "None planned",
        },
        { salesStageId: "negotiation" },
      ),
      activities: [plannedStep],
      now: NOW,
    });
    assert.equal(done.verdict.id, "clear_path");
    assert.match(done.verdict.impact, /permits and funding are confirmed/);
  });

  it("never treats Build-Own-Operate inputs as gates on a sale", () => {
    const sale = buildDealBrief({
      pipeline: deal(CUSTOMER_LAYER, { dealModel: "system" }),
      activities: [plannedStep],
      now: NOW,
    });
    assert.equal(sale.verdict.id, "clear_path");
  });

  it("never marks an assumed value as Confirmed", () => {
    const brief = buildDealBrief({
      pipeline: boo({ ...CUSTOMER_LAYER, site_readiness: INPUTS.site_readiness }),
      activities: [plannedStep],
      now: NOW,
    });
    const feedstock = brief.elements.find((element) => element.id === "feedstock_agreement");
    assert.equal(feedstock?.state, "unknown");
  });

  it("shows one checklist box per pillar and only ticks what is secured", () => {
    const brief = buildDealBrief({
      pipeline: boo({
        feedstock_agreement: INPUTS.feedstock_agreement,
        utilities: "Ducts partly prepared; capacity and tie-in terms must be confirmed",
        end_product: "Biochar offtake must be secured",
      }),
      activities: [],
      now: NOW,
    });
    const items = brief.want.checklist ?? [];
    assert.equal(items.length, 7);
    const state = (id: string) => items.find((item) => item.id === id)?.state;
    assert.equal(state("feedstock_agreement"), "confirmed");
    assert.equal(state("utilities"), "assumed");
    assert.equal(state("biochar_offtake"), "assumed");
    assert.equal(state("site_control"), "unknown");
    assert.match(brief.want.headline, /^1 of 7 secured/);
    assert.equal(brief.want.state, undefined);
  });

  it("treats 'not settled yet' notes as open work, not secured", () => {
    const brief = buildDealBrief({
      pipeline: boo({
        site_readiness: "Plot available, lease or purchase not yet agreed",
        permitting: "Application must be prepared, not in place",
      }),
      activities: [],
      now: NOW,
    });
    const state = (id: string) => brief.elements.find((e) => e.id === id)?.state;
    assert.equal(state("site_control"), "assumed");
    assert.equal(state("permitting"), "assumed");
  });

  it("speaks of partners, not customers, on a development project", () => {
    const brief = buildDealBrief({ pipeline: boo({}), activities: [], now: NOW });
    assert.match(brief.whatChanged, /No contact with the partners logged yet/);
  });
});

describe("Project related organization company picker helpers (FS-015)", () => {
  const companies: Company[] = [
    {
      id: 1,
      CompanyID: "CO-1014",
      Title: "ANTEC BIOGAS AS",
      CompanyTypes: ["Partner"],
    } as unknown as Company,
    {
      id: 2,
      CompanyID: "CO-1031",
      Title: "Allskog",
      CompanyTypes: ["Supplier / Vendor"],
      City: "Trondheim",
    } as unknown as Company,
    {
      id: 3,
      CompanyID: "CO-1074",
      Title: "Moelven Telemarksbruket AS",
      CompanyTypes: ["Supplier / Vendor"],
      City: "Bø i Telemark",
    } as unknown as Company,
  ];

  it("excludes already-linked organizations and filters by search query", () => {
    const linked = [
      { id: "org-1", companyId: "CO-1014", organizationType: "partner" as const, isPrimary: true },
    ];
    const available = filterAvailableProjectCompanies(companies, linked);
    assert.deepEqual(
      available.map((c) => c.CompanyID),
      ["CO-1031", "CO-1074"],
    );

    const bySearch = filterAvailableProjectCompanies(companies, linked, { query: "moelven" });
    assert.deepEqual(
      bySearch.map((c) => c.CompanyID),
      ["CO-1074"],
    );
  });

  it("suggests organization type from company classification and maps back to CompanyType", () => {
    assert.equal(suggestProjectOrganizationType(companies[1]!), "supplier");
    assert.equal(suggestProjectOrganizationType(companies[0]!), "partner");
    assert.equal(companyTypeForProjectOrganizationType("supplier"), "Supplier / Vendor");
    assert.equal(companyTypeForProjectOrganizationType("regulator"), "Public / Government");
  });
});
