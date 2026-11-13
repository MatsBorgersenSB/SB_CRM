import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isOpportunityActionTab } from "./opportunity-actions";
import {
  OPPORTUNITY_MISSION_CONTROL_VIEWS,
  isOpportunityMissionControlView,
  mapLegacyDealLocation,
} from "./opportunity-mission-control";

describe("mission control tabs", () => {
  it("has exactly four tabs including Work", () => {
    assert.deepEqual(
      OPPORTUNITY_MISSION_CONTROL_VIEWS.map((view) => view.id),
      ["overview", "understanding", "work", "ask"],
    );
  });

  it("no longer treats removed tabs as views", () => {
    for (const removed of ["gaps", "influence", "meetings", "emails", "actions"]) {
      assert.equal(isOpportunityMissionControlView(removed), false);
    }
  });
});

describe("mapLegacyDealLocation", () => {
  it("sends gaps and influence to Understanding", () => {
    assert.deepEqual(mapLegacyDealLocation("gaps", null), { view: "understanding" });
    assert.deepEqual(mapLegacyDealLocation("influence", null), { view: "understanding" });
  });

  it("sends meetings, emails, and actions to Work", () => {
    const meetings = mapLegacyDealLocation("meetings", null);
    const emails = mapLegacyDealLocation("emails", null);
    const actions = mapLegacyDealLocation("actions", "documents");
    assert.deepEqual(meetings, { view: "work", action: "meetings" });
    assert.deepEqual(emails, { view: "work", action: "emails" });
    assert.deepEqual(actions, { view: "work", action: "documents" });
    assert.ok(isOpportunityActionTab(meetings!.action!));
    assert.ok(isOpportunityActionTab(emails!.action!));
  });

  it("sends the old stakeholders action to Overview", () => {
    assert.deepEqual(mapLegacyDealLocation("actions", "stakeholders"), { view: "overview" });
    assert.deepEqual(mapLegacyDealLocation(null, "stakeholders"), { view: "overview" });
  });

  it("leaves current locations alone", () => {
    assert.equal(mapLegacyDealLocation("understanding", null), null);
    assert.equal(mapLegacyDealLocation("work", "documents"), null);
    assert.equal(mapLegacyDealLocation(null, null), null);
  });
});
