import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { GraphSearchResultItem } from "./graphSearch";
import { composeResolution } from "./omniOrchestrator";

const NOW = "2026-10-14T09:00:00.000Z";

function hit(partial: Partial<GraphSearchResultItem> & Pick<GraphSearchResultItem, "timestamp">): GraphSearchResultItem {
  return {
    id: partial.id ?? "hit-1",
    sourceType: partial.sourceType ?? "OUTLOOK",
    title: partial.title ?? "Flispris Q1",
    snippet: partial.snippet ?? "Pris per tonn.",
    webUrl: partial.webUrl ?? "https://outlook.office.com/mail/id/hit-1",
    timestamp: partial.timestamp,
  };
}

describe("temporal resolution", () => {
  it("treats a quote under six months as fresh and does not add suppliers", () => {
    const resolution = composeResolution({
      nowIso: NOW,
      taskDescription: "Finn G30-flis i Innlandet",
      internalHits: [hit({ timestamp: "2026-08-01T09:00:00.000Z" })],
      modelDraft: {
        summary: "Fersk intern pris.",
        sourcingSuggestions: [
          { name: "Oppfunnet Skog AS", category: "Skog", region: "Innlandet", reasoning: "Gjettet." },
        ],
      },
    });

    assert.equal(resolution.dataFreshness, "FRESH");
    assert.equal(resolution.internalEvidence[0]?.status, "FRESH");
    assert.equal(resolution.sourcingSuggestions.length, 0);
    assert.equal(resolution.suggestedNextAction.type, "REVIEW_DOC");
  });

  it("marks a 9-month feedstock note as aging and keeps only named model suggestions", () => {
    const resolution = composeResolution({
      nowIso: NOW,
      taskDescription: "Kjøp slam i Telemark",
      internalHits: [hit({ timestamp: "2026-01-10T09:00:00.000Z", title: "Slamtilbud" })],
      modelDraft: {
        summary: "Tilbudet er gammelt.",
        sourcingSuggestions: [
          {
            name: "Ukjent",
            category: "Slam",
            region: "Telemark",
            reasoning: "For vagt.",
          },
          {
            name: "Grenland avløp",
            category: "Slam",
            region: "Telemark",
            reasoning: "Regionalt renseanlegg å bekrefte.",
          },
        ],
      },
    });

    assert.equal(resolution.dataFreshness, "AGING");
    assert.equal(resolution.internalEvidence[0]?.status, "OUTDATED");
    assert.equal(resolution.sourcingSuggestions.length, 1);
    assert.equal(resolution.sourcingSuggestions[0]?.name, "Grenland avløp");
    assert.equal(resolution.suggestedNextAction.type, "CREATE_LEADS_AND_CALLS");
  });

  it("marks hits older than 12 months as outdated", () => {
    const resolution = composeResolution({
      nowIso: NOW,
      taskDescription: "Flispris",
      internalHits: [hit({ timestamp: "2025-05-01T09:00:00.000Z" })],
    });

    assert.equal(resolution.dataFreshness, "OUTDATED");
    assert.equal(resolution.suggestedNextAction.type, "DRAFT_REVALIDATION_EMAIL");
    assert.match(resolution.temporalNote ?? "", /12 months/);
  });

  it("does not invent suppliers when nothing internal exists and the model is empty", () => {
    const resolution = composeResolution({
      nowIso: NOW,
      taskDescription: "Procure G30 wood chips in Innlandet",
      internalHits: [],
    });

    assert.equal(resolution.dataFreshness, "EXTERNAL_ONLY");
    assert.equal(resolution.sourcingSuggestions.length, 0);
    assert.equal(resolution.suggestedNextAction.type, "REVIEW_DOC");
    assert.match(resolution.summary, /G30-flis/);
    assert.match(resolution.summary, /Innlandet/);
  });
});
