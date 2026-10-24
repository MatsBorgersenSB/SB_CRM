import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PipelineRow } from "@/types/pipeline";
import { explainOpportunityWinProbability } from "./opportunity-intelligence-engine";
import { canAssignOpportunityOwner } from "./permissions";
import { mapPrismaOpportunityToPipelineRow } from "./prisma-mappers";
import { computeCommercialViability } from "./commercial-viability-engine";
import { buildCustomOffering } from "./custom-offering";
import { buildGapsFromUnderstandingModel } from "./opportunity-understanding-model";
import { computeOpportunityQualification } from "./opportunity-qualification-engine";
import { resolveSalesMotion, understandingFieldsForPipeline } from "./sales-motion";

function deal(offeringIds: string[] | undefined, over: Partial<PipelineRow> = {}): PipelineRow {
  return {
    id: "PL-T1",
    assetName: "Test deal",
    companyRole: "Technology Buyer",
    targetFeedstock: "",
    reactorDesignCapacity: 0,
    currentMilestone: "",
    status: "Prospecting",
    salesValue: 0,
    currency: "EUR",
    probability: 20,
    offeringIds,
    ...over,
  } as PipelineRow;
}

describe("sales motion", () => {
  it("stays unclassified when no offerings are selected (Reality First)", () => {
    assert.equal(resolveSalesMotion(deal(undefined)).motion, null);
    assert.equal(resolveSalesMotion(deal([])).motion, null);
  });

  it("classifies a complete system or any deal containing the reactor as a system sale", () => {
    assert.equal(resolveSalesMotion(deal(["sys-complete-turnkey-pyrolysis"])).motion, "system");
    assert.equal(
      resolveSalesMotion(deal(["prod-pyrolysis-reactor", "prod-dryer", "svc-aftermarket"])).motion,
      "system",
    );
  });

  it("classifies a dryer or biochar as a product sale", () => {
    assert.equal(resolveSalesMotion(deal(["prod-dryer"])).motion, "product");
    assert.equal(resolveSalesMotion(deal(["prod-biochar"])).motion, "product");
    const custom = buildCustomOffering("product", "Biochar bags");
    assert.ok(custom);
    assert.equal(resolveSalesMotion(deal([custom.id])).motion, "product");
  });

  it("classifies service-only scope as consulting", () => {
    assert.equal(
      resolveSalesMotion(deal(["svc-project-development-fel2-fel3"])).motion,
      "consulting",
    );
  });
});

describe("opportunity owner", () => {
  it("lets admin, commercial and superuser assign an owner", () => {
    assert.ok(canAssignOpportunityOwner("admin"));
    assert.ok(canAssignOpportunityOwner("commercial"));
    assert.ok(canAssignOpportunityOwner("superuser"));
  });

  it("treats the 'system' placeholder as unassigned, not as a person", () => {
    const base = { id: "o1", name: "Biokull", ownerId: "system", company: null };
    assert.equal(mapPrismaOpportunityToPipelineRow(base as never).opportunityOwner, null);
    const named = mapPrismaOpportunityToPipelineRow({ ...base, ownerId: "1" } as never);
    assert.equal(named.opportunityOwner?.Title, "Mats Borgersen");
  });
});

describe("investigation depth", () => {
  it("asks 16 questions for a system sale but only 3 for a product sale", () => {
    assert.equal(understandingFieldsForPipeline(deal(["sys-complete-turnkey-pyrolysis"])).length, 16);
    const product = understandingFieldsForPipeline(deal(["prod-biochar"]));
    assert.deepEqual(
      product.map((field) => field.id).sort(),
      ["capacity", "decision_maker", "timeline"],
    );
    assert.equal(product.find((field) => field.id === "capacity")?.label, "Quantity or size");
  });

  it("never raises feedstock, permitting, offtake or site gaps on a product sale", () => {
    const gaps = buildGapsFromUnderstandingModel(deal(["prod-dryer"])).map((gap) => gap.id);
    for (const forbidden of [
      "feedstock_volume",
      "feedstock_quality",
      "permitting",
      "offtake_strategy",
      "site_readiness",
      "utilities",
      "funding_source",
    ]) {
      assert.ok(!gaps.includes(forbidden as never), `${forbidden} must not be a gap`);
    }
    assert.ok(gaps.length <= 3);
  });

  it("keeps the full investigation for a system sale", () => {
    const gaps = buildGapsFromUnderstandingModel(deal(["sys-complete-turnkey-pyrolysis"]));
    assert.ok(gaps.some((gap) => gap.id === "permitting"));
    assert.ok(gaps.some((gap) => gap.id === "feedstock_volume"));
  });

  it("does not flag project fatal flaws or grade project dimensions for a product sale", () => {
    const product = computeCommercialViability(deal(["prod-biochar"]), [], [], [], []);
    assert.equal(product.salesMotion, "product");
    const ids = product.dimensions.map((dim) => dim.id);
    for (const gone of ["feedstock_readiness", "project_readiness", "offtake_readiness", "revenue_path"]) {
      assert.ok(!ids.includes(gone as never), `${gone} must not be scored`);
    }
    for (const gone of ["no_feedstock", "no_site", "no_offtake", "no_financing", "unrealistic_permitting"]) {
      assert.ok(!product.fatalFlawAlerts.some((alert) => alert.id === gone));
    }
    assert.equal(product.businessModelLabel, "Product sale");

    const system = computeCommercialViability(
      deal(["sys-complete-turnkey-pyrolysis"]),
      [],
      [],
      [],
      [],
    );
    assert.equal(system.dimensions.length, 13);
    assert.ok(system.fatalFlawAlerts.some((alert) => alert.id === "no_feedstock"));
  });

  it("does not punish a product sale for missing project knowledge in win probability", () => {
    const product = explainOpportunityWinProbability(deal(["prod-biochar"]), [], [], []);
    assert.equal(product.probability, 40);
    assert.ok(!product.factors.some((f) => f.id === "stakeholder_coverage"));
    assert.ok(!product.factors.some((f) => f.id === "relationship_health"));
    assert.ok(!product.factors.some((f) => f.id.startsWith("risk_")));

    const system = explainOpportunityWinProbability(
      deal(["sys-complete-turnkey-pyrolysis"]),
      [],
      [],
      [],
    );
    assert.ok(system.probability < product.probability);
  });

  it("qualifies a product sale with a quote action, not a bankability assessment", () => {
    const q = computeOpportunityQualification(deal(["prod-dryer"]), [], [], [], []);
    assert.equal(q.commercialPotential, "product_sale");
    assert.ok(!/bankability/i.test(q.recommendedAction));
    assert.ok(q.dimensions.length <= 4);
  });
});
