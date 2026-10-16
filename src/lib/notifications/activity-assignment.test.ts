import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assignmentNoticeCopy,
  assignmentNoticeLink,
  assignmentShouldNotify,
} from "./activity-assignment";

describe("assignmentShouldNotify", () => {
  it("pings when ownership moves to another colleague", () => {
    assert.equal(
      assignmentShouldNotify({
        previousOwnerId: 1,
        nextOwnerId: 101,
        assignerId: 1,
        assignerEmail: "mats.borgersen@standard.bio",
        assigneeEmail: "hugo.jansson@standard.bio",
      }),
      true,
    );
  });

  it("does not ping when you assign the work to yourself", () => {
    assert.equal(
      assignmentShouldNotify({
        previousOwnerId: null,
        nextOwnerId: 1,
        assignerId: 1,
        assignerEmail: "mats.borgersen@standard.bio",
        assigneeEmail: "mats.borgersen@standard.bio",
      }),
      false,
    );
  });

  it("does not ping when the owner did not change", () => {
    assert.equal(
      assignmentShouldNotify({
        previousOwnerId: 101,
        nextOwnerId: 101,
        assignerId: 1,
      }),
      false,
    );
  });

  it("pings on first assign to someone else", () => {
    assert.equal(
      assignmentShouldNotify({
        previousOwnerId: null,
        nextOwnerId: 100,
        assignerId: 1,
        assignerTitle: "Mats Borgersen",
        assigneeTitle: "Walter Aker",
      }),
      true,
    );
  });
});

describe("assignmentNoticeLink", () => {
  it("treats a later reassignment as a new ping", () => {
    const first = assignmentNoticeLink({
      activityId: "ACT-12",
      assigneeId: 101,
      previousOwnerId: null,
    });
    const again = assignmentNoticeLink({
      activityId: "ACT-12",
      assigneeId: 101,
      previousOwnerId: 1,
    });
    assert.notEqual(first, again);
  });
});

describe("assignmentNoticeCopy", () => {
  it("says who assigned what, with a way back into SmartCRM", () => {
    const copy = assignmentNoticeCopy({
      subject: "Follow-up with Eramet",
      assignerTitle: "Mats Borgersen",
      companyName: "Eramet",
      openUrl: "https://sb-crm-seven.vercel.app/activities/ACT-12",
    });
    assert.equal(copy.title, "Assigned to you");
    assert.match(copy.message, /Mats Borgersen assigned you: Follow-up with Eramet/);
    assert.match(copy.html, /Open in SmartCRM/);
    assert.match(copy.html, /Eramet/);
  });
});
