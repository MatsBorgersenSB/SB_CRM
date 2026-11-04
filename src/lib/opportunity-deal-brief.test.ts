import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Activity } from "@/types/activity";
import type { AttentionItem } from "@/types/attention-item";
import type { FatalFlawAlert } from "@/types/commercial-viability";
import type { PipelineRow } from "@/types/pipeline";
import { buildDealBrief, dealBriefApplies } from "./opportunity-deal-brief";

const NOW = new Date("2026-11-04T12:00:00Z");

function pipeline(fields: Record<string, string> = {}, team: unknown[] = []): PipelineRow {
  return {
    id: "PL-1",
    assetName: "Antec Hornindal",
    offeringIds: [],
    team,
    salesValue: 0,
    currency: "EUR",
    reactorDesignCapacity: 0,
    targetFeedstock: "",
    understanding: { fields },
  } as unknown as PipelineRow;
}

function activity(overrides: Partial<Activity>): Activity {
  return {
    id: 1,
    ActivityID: "ACT-1",
    ActivityType: "Meeting",
    ActivityDate: "2026-11-01T10:00:00Z",
    Subject: "Intro meeting",
    ActivityDescription: "",
    Company: null,
    Contact: { Title: "C-1" },
    Deal: { Title: "PL-1" },
    ActivityOwner: null,
    ActionRequired: false,
    NextAction: "",
    NextActionDate: "",
    ActionStatus: "Completed",
    ActionOutcome: "",
    ...overrides,
  } as unknown as Activity;
}

const CONFIRMED = {
  customer_problem: "Disposal cost is rising",
  why_now: "Landfill ban from 2027",
  decision_maker: "Thea, plant manager",
};

const plannedStep = activity({
  ActivityID: "ACT-2",
  ActivityType: "Teams Meeting",
  ActivityDate: "2026-11-12T09:00:00Z",
  ActionStatus: "Planned",
  Subject: "Technical walkthrough",
});

describe("dealBriefApplies", () => {
  it("applies to deals without a lean sales motion", () => {
    assert.equal(dealBriefApplies(pipeline()), true);
  });
});

describe("buildDealBrief verdict", () => {
  it("is Not yet understood when nothing is captured", () => {
    const brief = buildDealBrief({ pipeline: pipeline(), activities: [], now: NOW });
    assert.equal(brief.verdict.id, "not_understood");
    assert.equal(brief.want.headline, "Not confirmed yet");
    assert.equal(brief.want.state, "unknown");
    assert.equal(brief.weakestLink, "customer_problem");
    assert.ok(brief.verdict.impact.length > 0);
  });

  it("keeps an inferred objective as Assumed and does not move the verdict", () => {
    const brief = buildDealBrief({
      pipeline: pipeline(),
      activities: [],
      assumedProblem: "Achieve a commercially viable processing outcome",
      now: NOW,
    });
    assert.equal(brief.want.state, "assumed");
    assert.match(brief.want.headline, /^Working view, not confirmed/);
    assert.equal(brief.verdict.id, "not_understood");
  });

  it("is Needs attention when the problem is known but the decider is not", () => {
    const brief = buildDealBrief({
      pipeline: pipeline({ customer_problem: "Disposal cost is rising", why_now: "Ban 2027" }),
      activities: [],
      now: NOW,
    });
    assert.equal(brief.verdict.id, "needs_attention");
    assert.equal(brief.weakestLink, "who_decides");
    assert.match(brief.blocker.headline, /who can say yes/);
  });

  it("is Needs attention when no dated next step is agreed", () => {
    const brief = buildDealBrief({
      pipeline: pipeline(CONFIRMED),
      activities: [activity({})],
      now: NOW,
    });
    assert.equal(brief.verdict.id, "needs_attention");
    assert.equal(brief.weakestLink, "next_step");
  });

  it("is Clear path when problem, decider, reason and next step are confirmed", () => {
    const brief = buildDealBrief({
      pipeline: pipeline(CONFIRMED),
      activities: [activity({}), plannedStep],
      now: NOW,
    });
    assert.equal(brief.verdict.id, "clear_path");
    assert.match(brief.next.headline, /Keep the agreed step on track/);
    assert.match(brief.next.headline, /2026-11-12/);
  });

  it("counts a roster-assigned decision maker as confirmed", () => {
    const brief = buildDealBrief({
      pipeline: pipeline({ customer_problem: "x", why_now: "y" }, [
        { projectRole: "Decision Maker" },
      ]),
      activities: [plannedStep],
      now: NOW,
    });
    const who = brief.elements.find((element) => element.id === "who_decides");
    assert.equal(who?.state, "confirmed");
    assert.equal(who?.source, "Assigned on the opportunity roster");
  });
});

describe("buildDealBrief risk", () => {
  it("is At risk after customer silence beyond the threshold", () => {
    const brief = buildDealBrief({
      pipeline: pipeline(CONFIRMED),
      activities: [activity({ ActivityDate: "2026-09-20T10:00:00Z" })],
      now: NOW,
    });
    assert.equal(brief.verdict.id, "at_risk");
    assert.match(brief.verdict.impact, /going cold/);
    assert.match(brief.next.headline, /Re-contact/);
  });

  it("does not flag silence when there has never been contact", () => {
    const brief = buildDealBrief({ pipeline: pipeline(CONFIRMED), activities: [], now: NOW });
    assert.notEqual(brief.verdict.id, "at_risk");
    assert.match(brief.whatChanged, /No customer contact logged yet/);
  });

  it("is At risk on a critical fatal flaw and uses its impact", () => {
    const alert = {
      id: "no_permit",
      label: "Permit path blocked",
      detail: "Site cannot be permitted",
      severity: "critical",
      impact: ["The plant cannot be built on this site."],
      recommendedAction: "Review alternative sites",
      href: "/x",
    } as unknown as FatalFlawAlert;
    const brief = buildDealBrief({
      pipeline: pipeline(CONFIRMED),
      activities: [activity({}), plannedStep],
      fatalFlawAlerts: [alert],
      now: NOW,
    });
    assert.equal(brief.verdict.id, "at_risk");
    assert.equal(brief.verdict.impact, "The plant cannot be built on this site.");
    assert.equal(brief.blocker.headline, "Permit path blocked");
    assert.equal(brief.next.headline, "Review alternative sites");
  });

  it("ignores medium fatal flaws", () => {
    const alert = {
      label: "Minor",
      detail: "d",
      severity: "medium",
      impact: [],
      recommendedAction: "a",
    } as unknown as FatalFlawAlert;
    const brief = buildDealBrief({
      pipeline: pipeline(CONFIRMED),
      activities: [activity({}), plannedStep],
      fatalFlawAlerts: [alert],
      now: NOW,
    });
    assert.equal(brief.verdict.id, "clear_path");
  });

  it("is At risk on an urgent open attention item for this deal only", () => {
    const item = (sourceObjectId: string) =>
      ({
        severity: "urgent",
        status: "open",
        sourceObjectId,
        recommendation: "Customer asked for a quote five days ago.",
        suggestedAiAction: "Send the quote",
      }) as unknown as AttentionItem;
    const own = buildDealBrief({
      pipeline: pipeline(CONFIRMED),
      activities: [activity({}), plannedStep],
      attentionItems: [item("PL-1")],
      now: NOW,
    });
    assert.equal(own.verdict.id, "at_risk");
    const other = buildDealBrief({
      pipeline: pipeline(CONFIRMED),
      activities: [activity({}), plannedStep],
      attentionItems: [item("PL-2")],
      now: NOW,
    });
    assert.equal(other.verdict.id, "clear_path");
  });
});

describe("buildDealBrief next step and changes", () => {
  it("ignores a planned step with no customer contact", () => {
    const brief = buildDealBrief({
      pipeline: pipeline(CONFIRMED),
      activities: [activity({}), { ...plannedStep, Contact: null, LinkedContacts: [] }],
      now: NOW,
    });
    const step = brief.elements.find((element) => element.id === "next_step");
    assert.equal(step?.state, "unknown");
  });

  it("does not treat an overdue follow-up as an agreed next step", () => {
    const brief = buildDealBrief({
      pipeline: pipeline(CONFIRMED),
      activities: [
        activity({
          ActionRequired: true,
          NextAction: "Send quote",
          NextActionDate: "2026-10-30",
          ActionStatus: "Open",
        }),
      ],
      now: NOW,
    });
    const step = brief.elements.find((element) => element.id === "next_step");
    assert.equal(step?.state, "unknown");
  });

  it("reports what changed since the last visit", () => {
    const brief = buildDealBrief({
      pipeline: pipeline(CONFIRMED),
      activities: [activity({ ActivityDate: "2026-11-03T10:00:00Z" })],
      lastVisitedAt: "2026-11-02T00:00:00Z",
      now: NOW,
    });
    assert.match(brief.whatChanged, /Last customer contact: meeting yesterday/);
    assert.match(brief.whatChanged, /1 new activity/);
  });

  it("always gives every row an impact", () => {
    for (const fields of [{}, CONFIRMED]) {
      const brief = buildDealBrief({ pipeline: pipeline(fields), activities: [], now: NOW });
      for (const row of [brief.want, brief.blocker, brief.next]) {
        assert.ok(row.impact.trim().length > 0);
      }
    }
  });
});
