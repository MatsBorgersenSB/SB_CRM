import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Activity } from "@/types/activity";
import type { PipelineRow } from "@/types/pipeline";
import { buildDealBrief, dealBriefApplies } from "./opportunity-deal-brief";
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

  it("drops budget and economic buyer, adds feedstock agreement and public funding", () => {
    const list = ids(boo({}));
    assert.ok(!list.includes("budget"));
    assert.ok(!list.includes("economic_buyer"));
    assert.ok(list.includes("feedstock_agreement"));
    assert.ok(list.includes("public_funding"));
    assert.ok(list.includes("customer_problem"));
  });

  it("rewords shared fields for Build-Own-Operate", () => {
    const fields = understandingFieldsForPipeline(boo({}));
    const site = fields.find((field) => field.id === "site_readiness");
    assert.equal(site?.label, "Site control (land plot)");
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
  it("applies and uses Build-Own-Operate column headings", () => {
    assert.equal(dealBriefApplies(boo({})), true);
    const brief = buildDealBrief({ pipeline: boo({}), activities: [], now: NOW });
    assert.equal(brief.columns.want, "What they need solved");
    assert.equal(brief.columns.blocker, "What is blocking the plant");
    assert.equal(brief.verdict.id, "not_understood");
  });

  it("keeps customer wording for Sell the system", () => {
    const brief = buildDealBrief({ pipeline: deal({}), activities: [], now: NOW });
    assert.equal(brief.columns.want, "What the customer wants");
  });

  it("needs attention while energy/output offtake is missing", () => {
    const brief = buildDealBrief({
      pipeline: boo(CUSTOMER_LAYER),
      activities: [plannedStep],
      now: NOW,
    });
    assert.equal(brief.verdict.id, "needs_attention");
    assert.equal(brief.weakestLink, "offtake");
    assert.equal(brief.blocker.fieldId, "offtake_strategy");
    assert.equal(brief.next.fieldId, "offtake_strategy");
  });

  it("needs attention while biochar product offtake is missing", () => {
    const brief = buildDealBrief({
      pipeline: boo({
        ...CUSTOMER_LAYER,
        offtake_strategy: INPUTS.offtake_strategy,
      }),
      activities: [plannedStep],
      now: NOW,
    });
    assert.equal(brief.verdict.id, "needs_attention");
    assert.equal(brief.weakestLink, "biochar_offtake");
    assert.equal(brief.blocker.fieldId, "end_product");
  });

  it("needs attention while the feedstock agreement is missing", () => {
    const brief = buildDealBrief({
      pipeline: boo({
        ...CUSTOMER_LAYER,
        offtake_strategy: INPUTS.offtake_strategy,
        end_product: INPUTS.end_product,
      }),
      activities: [plannedStep],
      now: NOW,
    });
    assert.equal(brief.verdict.id, "needs_attention");
    assert.equal(brief.weakestLink, "feedstock_agreement");
    assert.match(brief.verdict.impact, /no plant to finance/);
    assert.equal(brief.blocker.fieldId, "feedstock_agreement");
    assert.equal(brief.next.fieldId, "feedstock_agreement");
  });

  it("needs attention while site control is missing", () => {
    const brief = buildDealBrief({
      pipeline: boo({
        ...CUSTOMER_LAYER,
        offtake_strategy: INPUTS.offtake_strategy,
        end_product: INPUTS.end_product,
        feedstock_agreement: INPUTS.feedstock_agreement,
      }),
      activities: [plannedStep],
      now: NOW,
    });
    assert.equal(brief.verdict.id, "needs_attention");
    assert.equal(brief.weakestLink, "site_control");
    assert.equal(brief.blocker.fieldId, "site_readiness");
  });

  it("needs attention while utilities are missing", () => {
    const brief = buildDealBrief({
      pipeline: boo({
        ...CUSTOMER_LAYER,
        offtake_strategy: INPUTS.offtake_strategy,
        end_product: INPUTS.end_product,
        feedstock_agreement: INPUTS.feedstock_agreement,
        site_readiness: INPUTS.site_readiness,
      }),
      activities: [plannedStep],
      now: NOW,
    });
    assert.equal(brief.verdict.id, "needs_attention");
    assert.equal(brief.weakestLink, "utilities");
    assert.equal(brief.blocker.fieldId, "utilities");
  });

  it("is a Clear path once inputs are secured, and points at permits and funding", () => {
    const brief = buildDealBrief({
      pipeline: boo({ ...CUSTOMER_LAYER, ...INPUTS }),
      activities: [plannedStep],
      now: NOW,
    });
    assert.equal(brief.verdict.id, "clear_path");
    assert.match(brief.verdict.impact, /permits and funding/);
    assert.equal(brief.blocker.fieldId, "permitting");
    assert.equal(brief.next.fieldId, "permitting");
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

  it("gates on permits and funding from the negotiation stage onward", () => {
    const base = { ...CUSTOMER_LAYER, ...INPUTS };
    const open = buildDealBrief({
      pipeline: boo(base, { salesStageId: "negotiation" }),
      activities: [plannedStep],
      now: NOW,
    });
    assert.equal(open.verdict.id, "needs_attention");
    assert.equal(open.weakestLink, "permitting");

    const partly = buildDealBrief({
      pipeline: boo({ ...base, permitting: "Permit granted" }, { salesStageId: "negotiation" }),
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
});
