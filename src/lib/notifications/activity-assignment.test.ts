import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assignmentNoticeCopy,
  assignmentNoticeLink,
  assignmentShouldNotify,
  ownershipNoticeCopy,
  ownershipNoticeLink,
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

  it("builds ownership notice copy and links for companies, contacts, opportunities, and projects", () => {
    const companyLink = ownershipNoticeLink({
      kind: "company",
      entityId: "CO-1044",
      assigneeId: 102,
      previousOwnerId: 1,
    });
    assert.equal(companyLink, "/companies/CO-1044?assigned=102&from=1");

    const companyCopy = ownershipNoticeCopy({
      kind: "company",
      subject: "Mjørud AS",
      assignerTitle: "Mats Borgersen",
      openUrl: `https://sb-crm-seven.vercel.app${companyLink}`,
    });
    assert.equal(companyCopy.title, "Account ownership assigned to you");
    assert.match(
      companyCopy.message,
      /Mats Borgersen assigned you responsibility for company: Mjørud AS/,
    );
    assert.match(companyCopy.html, /Account Owner/);

    const contactLink = ownershipNoticeLink({
      kind: "contact",
      entityId: "CT-1001",
      assigneeId: 102,
      previousOwnerId: 1,
    });
    assert.equal(contactLink, "/contacts/CT-1001?assigned=102&from=1");

    const contactCopy = ownershipNoticeCopy({
      kind: "contact",
      subject: "Aleksander Lindh",
      companyName: "Mjørud AS",
      assignerTitle: "Mats Borgersen",
      openUrl: `https://sb-crm-seven.vercel.app${contactLink}`,
    });
    assert.equal(contactCopy.title, "Contact ownership assigned to you");
    assert.match(
      contactCopy.message,
      /Mats Borgersen assigned you responsibility for contact: Aleksander Lindh \(Mjørud AS\)/,
    );
    assert.match(contactCopy.html, /Contact Owner/);

    const dealCopy = ownershipNoticeCopy({
      kind: "opportunity",
      subject: "VEAS Biokull",
      companyName: "VEAS",
      assignerTitle: "Mats Borgersen",
      openUrl: "https://sb-crm-seven.vercel.app/opportunities/OPP-1001",
    });
    assert.equal(dealCopy.title, "Opportunity ownership assigned to you");
    assert.match(
      dealCopy.message,
      /Mats Borgersen assigned you responsibility for opportunity: VEAS Biokull \(VEAS\)/,
    );

    const projectCopy = ownershipNoticeCopy({
      kind: "project",
      subject: "VEAS Pilot",
      assignerTitle: "Mats Borgersen",
      openUrl: "https://sb-crm-seven.vercel.app/projects/PRJ-VEAS",
    });
    assert.equal(projectCopy.title, "Project ownership assigned to you");
    assert.match(
      projectCopy.message,
      /Mats Borgersen assigned you responsibility for project: VEAS Pilot/,
    );
  });
});
