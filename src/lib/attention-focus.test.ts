import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  attentionImpact,
  attentionSummaryLine,
  countUpcomingTasks,
  dedupeAttentionByCompany,
  dedupeByCompany,
  dedupeQueueByCompany,
} from "./attention-focus";
import type { Activity } from "@/types/activity";
import { groupAttentionBySeverity, type AttentionItem } from "@/types/attention-item";

function item(partial: Partial<AttentionItem> & { id: string }): AttentionItem {
  return {
    sourceObjectId: partial.id,
    sourceObjectName: partial.id,
    objectType: "Opportunity",
    severity: "needs_attention",
    status: "open",
    recommendation: "r",
    suggestedAiAction: "a",
    href: "/x",
    ruleId: "stalled_opportunity",
    ...partial,
  };
}

describe("dedupeAttentionByCompany", () => {
  it("keeps one row per company, the most severe first", () => {
    const rows = dedupeAttentionByCompany([
      item({ id: "a1", companyId: "CO-1", severity: "needs_attention" }),
      item({ id: "a2", companyId: "CO-1", severity: "urgent" }),
      item({ id: "b1", companyId: "CO-2", severity: "needs_attention" }),
    ]);
    assert.deepEqual(
      rows.map((row) => row.id).sort(),
      ["a2", "b1"],
    );
  });

  it("falls back to the object when there is no company", () => {
    const rows = dedupeAttentionByCompany([item({ id: "x" }), item({ id: "y" })]);
    assert.equal(rows.length, 2);
  });
});

describe("headline and summary share one set", () => {
  it("never counts a company twice", () => {
    const queue = dedupeQueueByCompany(
      groupAttentionBySeverity([
        item({ id: "1", companyId: "CO-1", severity: "urgent" }),
        item({ id: "2", companyId: "CO-1", severity: "urgent" }),
        item({ id: "3", companyId: "CO-2", severity: "needs_attention" }),
        item({ id: "4", companyId: "CO-3", severity: "waiting" }),
      ]),
    );
    assert.equal(queue.urgent.length, 1);
    assert.equal(attentionSummaryLine(queue), "1 more need attention soon · 1 waiting on others.");
  });

  it("stays silent when the headline already says everything", () => {
    const queue = groupAttentionBySeverity([item({ id: "1", severity: "urgent" })]);
    assert.equal(attentionSummaryLine(queue), undefined);
  });
});

describe("attentionImpact", () => {
  const rules = [
    "stalled_opportunity",
    "no_recent_contact",
    "maintain_momentum",
    "no_activity",
    "make_first_contact",
    "missing_stakeholders",
    "add_primary_contact",
    "overdue_followup",
    "due_today",
    "incomplete_document_set",
    "package_not_transmitted",
    "classify_relationship",
    "supplier_follow_through",
    "create_new_opportunity",
    "risk_threshold_exceeded",
    "some_future_rule",
  ];

  it("names the company and never shows a sentinel number", () => {
    for (const ruleId of rules) {
      const text = attentionImpact({
        ruleId,
        companyName: "Eramet",
        sourceObjectName: "Deal",
        severity: "urgent",
      });
      assert.match(text, /Eramet/, ruleId);
      assert.doesNotMatch(text, /999/, ruleId);
    }
  });

  it("differs by situation instead of repeating one line", () => {
    const texts = new Set(
      rules.map((ruleId) =>
        attentionImpact({
          ruleId,
          companyName: "Eramet",
          sourceObjectName: "Deal",
          severity: "urgent",
        }),
      ),
    );
    assert.ok(texts.size >= 8);
  });
});

describe("dedupeByCompany", () => {
  it("keeps the first proposal per company in ranked order", () => {
    const rows = dedupeByCompany([
      { id: "p1", companyId: "CO-1" },
      { id: "p2", companyId: "CO-1" },
      { id: "p3" },
    ]);
    assert.deepEqual(rows.map((row) => row.id), ["p1", "p3"]);
  });
});

describe("commitments on Today", () => {
  it("lets an overdue commitment lead over a same-severity suggestion for the company", () => {
    const rows = dedupeAttentionByCompany([
      item({ id: "risk", companyId: "CO-1", severity: "urgent", ruleId: "stalled_opportunity" }),
      item({ id: "promise", companyId: "CO-1", severity: "urgent", ruleId: "overdue_followup" }),
    ]);
    assert.deepEqual(rows.map((row) => row.id), ["promise"]);
  });

  it("names overdue commitments in the summary line", () => {
    const queue = groupAttentionBySeverity([
      item({ id: "p1", companyId: "CO-1", severity: "urgent", ruleId: "overdue_followup" }),
      item({ id: "p2", companyId: "CO-2", severity: "urgent", ruleId: "stalled_opportunity" }),
    ]);
    assert.match(attentionSummaryLine(queue) ?? "", /1 is an overdue commitment/);
  });

  it("counts only my open tasks due later this week, excluding rows already shown", () => {
    const now = new Date("2026-10-23T09:00:00");
    const task = (id: string, owner: string, due: string, extra: object = {}) =>
      ({
        ActivityID: id,
        ActivityType: "Task",
        ActionRequired: true,
        ActionStatus: "Open",
        ActivityOwner: { Title: owner },
        NextActionDate: due,
        ...extra,
      }) as unknown as Activity;
    const activities = [
      task("a", "Mats Borgersen", "2026-10-26"),
      task("b", "Mats Borgersen", "2026-10-23"),
      task("c", "Mats Borgersen", "2026-11-20"),
      task("d", "Walter Aker", "2026-10-26"),
      task("e", "Mats Borgersen", "2026-10-27", { ActionStatus: "Completed" }),
      task("f", "Mats Borgersen", "2026-10-28"),
    ];
    assert.equal(countUpcomingTasks(activities, "Mats Borgersen", new Set(["f"]), now), 1);
    assert.equal(countUpcomingTasks(activities, undefined, new Set(), now), 0);
  });
});
