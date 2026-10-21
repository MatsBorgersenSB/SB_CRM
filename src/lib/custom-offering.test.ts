import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCustomOffering, offeringFromCustomId } from "./custom-offering";
import { formatOfferingLabels, resolveOfferings } from "./standard-bio-offerings";

describe("custom offerings", () => {
  it("keeps a user-named product as a selectable offering", () => {
    const offering = buildCustomOffering("product", "  Biochar bags  ");
    assert.ok(offering);
    assert.equal(offering.name, "Biochar bags");
    assert.equal(offering.category, "product");
    assert.equal(resolveOfferings([offering.id])[0]?.name, "Biochar bags");
    assert.equal(formatOfferingLabels([offering.id]), "Biochar bags");
  });

  it("ignores a name that is too short", () => {
    assert.equal(buildCustomOffering("system", " A "), null);
    assert.equal(offeringFromCustomId("custom:service:x"), undefined);
  });
});
