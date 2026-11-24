import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildMyTasksOverview, buildMyWorkQueue } from "./my-work-queue";
import type { Activity } from "@/types/activity";
import type { AuthUser } from "@/types/auth";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";

const hugo: AuthUser = {
  id: 101,
  displayName: "Hugo Jansson",
  role: "commercial",
  email: "hugo.jansson@standard.bio",
};

function company(partial: Partial<Company> & Pick<Company, "CompanyID" | "Title">): Company {
  return {
    CompanyTypes: [],
    Status: "Active",
    pipelineIds: [],
    contacts: [],
    AccountOwner: null,
    ...partial,
  } as Company;
}

describe("buildMyWorkQueue", () => {
  it("includes owned companies and shared tasks for the colleague", () => {
    const companies = [
      company({
        CompanyID: "C1",
        Title: "Escalante",
        AccountOwner: {
          Id: 101,
          Title: "Hugo Jansson",
          Email: "hugo.jansson@standard.bio",
        },
      }),
      company({
        CompanyID: "C2",
        Title: "Other",
        AccountOwner: { Id: 100, Title: "Walter Aker", Email: "walter.aker@standard.bio" },
      }),
    ];

    const pipelines: PipelineRow[] = [
      {
        id: "PL-1",
        assetName: "Plant A",
        companyRole: "Technology Buyer",
        targetFeedstock: "",
        reactorDesignCapacity: 0,
        currentMilestone: "",
        status: "Prospecting",
        salesValue: 0,
        currency: "EUR",
        probability: 0,
        opportunityOwner: {
          Id: 101,
          Title: "Hugo Jansson",
          Email: "hugo.jansson@standard.bio",
        },
        linkedCompanyIds: ["C1"],
      },
    ];

    const activities = [
      {
        ActivityID: "ACT-1",
        ActivityType: "Task",
        Subject: "Shared follow-up",
        ActionStatus: "Open",
        ActivityOwner: { Id: 100, Title: "Walter Aker" },
        SharedWith: [
          { Id: 101, Title: "Hugo Jansson", Email: "hugo.jansson@standard.bio" },
        ],
      } as Activity,
    ];

    const queue = buildMyWorkQueue({
      user: hugo,
      companies,
      pipelines,
      activities,
    });

    assert.equal(queue.assigned.some((item) => item.kind === "company"), true);
    assert.equal(queue.assigned.some((item) => item.kind === "opportunity"), true);
    assert.equal(queue.watching.some((item) => item.kind === "shared_task"), true);

    const overview = buildMyTasksOverview(queue, "2026-11-13");
    assert.equal(overview.doNow.length, 1);
    assert.equal(overview.doNow[0]?.kind, "shared_task");
    assert.equal(overview.youOwn.length, 2);
    assert.equal(overview.openCount, 1);
  });

  it("ranks overdue tasks first in Do now", () => {
    const activities = [
      {
        ActivityID: "ACT-LATER",
        ActivityType: "Task",
        Subject: "Later",
        ActionStatus: "Open",
        NextActionDate: "2026-12-01",
        ActivityOwner: {
          Id: 101,
          Title: "Hugo Jansson",
          Email: "hugo.jansson@standard.bio",
        },
      } as Activity,
      {
        ActivityID: "ACT-OVERDUE",
        ActivityType: "Task",
        Subject: "Overdue land plot",
        ActionStatus: "Open",
        NextActionDate: "2026-10-01",
        ActivityOwner: {
          Id: 101,
          Title: "Hugo Jansson",
          Email: "hugo.jansson@standard.bio",
        },
      } as Activity,
    ];

    const queue = buildMyWorkQueue({
      user: hugo,
      companies: [],
      pipelines: [],
      activities,
    });
    const overview = buildMyTasksOverview(queue, "2026-11-13");

    assert.equal(overview.openCount, 2);
    assert.equal(overview.overdueCount, 1);
    assert.equal(overview.doNow[0]?.title, "Overdue land plot");
    assert.equal(overview.nextDue, "2026-10-01");
  });
});
