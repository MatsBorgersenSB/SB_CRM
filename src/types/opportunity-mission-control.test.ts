import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isOpportunityActionTab } from "./opportunity-actions";
import {
  OPPORTUNITY_MISSION_CONTROL_VIEWS,
  isOpportunityMissionControlView,
  mapLegacyDealLocation,
} from "./opportunity-mission-control";

describe("mission control tabs", () => {
  it("has exactly four tabs", () => {
    assert.deepEqual(
      OPPORTUNITY_MISSION_CONTROL_VIEWS.map((view) => view.id),
      ["overview", "understanding", "actions", "ask"],
    );
  });

  it("no longer treats removed tabs as views", () => {
    for (const removed of ["gaps", "influence", "meetings", "emails"]) {
      assert.equal(isOpportunityMissionControlView(removed), false);
    }
  });
});

describe("mapLegacyDealLocation", () => {
  it("sends gaps and influence to Understanding", () => {
    assert.deepEqual(mapLegacyDealLocation("gaps", null), { view: "understanding" });
    assert.deepEqual(mapLegacyDealLocation("influence", null), { view: "understanding" });
  });

  it("sends meetings and emails to Actions sub-tabs that exist", () => {
    const meetings = mapLegacyDealLocation("meetings", null);
    const emails = mapLegacyDealLocation("emails", null);
    assert.deepEqual(meetings, { view: "actions", action: "meetings" });
    assert.deepEqual(emails, { view: "actions", action: "emails" });
    assert.ok(isOpportunityActionTab(meetings!.action!));
    assert.ok(isOpportunityActionTab(emails!.action!));
  });

  it("sends the old stakeholders action to Overview", () => {
    assert.deepEqual(mapLegacyDealLocation("actions", "stakeholders"), { view: "overview" });
    assert.deepEqual(mapLegacyDealLocation(null, "stakeholders"), { view: "overview" });
  });

  it("leaves current locations alone", () => {
    assert.equal(mapLegacyDealLocation("understanding", null), null);
    assert.equal(mapLegacyDealLocation("actions", "documents"), null);
    assert.equal(mapLegacyDealLocation(null, null), null);
  });
});
