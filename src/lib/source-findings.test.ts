import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  appendSourceFinding,
  createSourceFinding,
  type SourceFinding,
  type SourceFindingClaim,
} from "./source-findings";

function claim(
  id: string,
  statement: string,
  fieldId?: SourceFindingClaim["fieldId"],
  decision?: SourceFindingClaim["decision"],
): SourceFindingClaim {
  return {
    id,
    statement,
    impact: "Matters for the package.",
    fieldId,
    decision,
  };
}

function finding(
  partial: Partial<SourceFinding> & Pick<SourceFinding, "id" | "claims">,
): SourceFinding {
  return {
    title: "Vest Biogass",
    addedAt: "2026-10-01T00:00:00.000Z",
    kind: "url",
    url: "https://vestbiogass.no/",
    ...partial,
  };
}

describe("URL findings stay unconfirmed until a person validates them", () => {
  it("does not keep a confirmed decision that arrived with the page read", () => {
    const incoming = createSourceFinding({
      title: "Vest Biogass",
      url: "https://vestbiogass.no/",
      kind: "url",
      claims: [
        claim(
          "feedstock-volume",
          "Reported plant volume: 150 000 tonn.",
          "feedstock_volume",
          "confirmed",
        ),
      ],
    });

    const next = appendSourceFinding([], incoming);
    assert.equal(next[0]?.claims[0]?.decision, undefined);
    assert.equal(next[0]?.claims[0]?.statement, "Reported plant volume: 150 000 tonn.");
  });

  it("does not ask again for a field this opportunity already has", () => {
    const incoming = createSourceFinding({
      title: "Vest Biogass",
      url: "https://vestbiogass.no/about",
      kind: "url",
      claims: [
        claim(
          "feedstock-volume",
          "Reported plant volume: 150 000 tonn.",
          "feedstock_volume",
        ),
        claim("offtake", "The source indicates gas offtake or an LBG path.", "offtake_strategy"),
      ],
    });

    const next = appendSourceFinding([], incoming, ["feedstock_volume"]);
    assert.deepEqual(
      next[0]?.claims.map((row) => row.fieldId),
      ["offtake_strategy"],
    );
    assert.equal(next[0]?.claims[0]?.decision, undefined);
  });

  it("keeps a confirmed fact when the same URL is added again and only asks for what is new", () => {
    const existing = finding({
      id: "finding-1",
      claims: [
        claim(
          "feedstock-volume",
          "Reported plant volume: 150 000 tonn.",
          "feedstock_volume",
          "confirmed",
        ),
      ],
    });
    const incoming = createSourceFinding({
      title: "Vest Biogass",
      url: "https://vestbiogass.no/",
      kind: "url",
      claims: [
        claim(
          "feedstock-volume",
          "Reported plant volume: 150 000 tonn.",
          "feedstock_volume",
          "confirmed",
        ),
        claim("timeline", "Reported start of sales around 2027.", "timeline"),
      ],
    });

    const next = appendSourceFinding([existing], incoming);
    assert.equal(next.length, 1);
    assert.equal(next[0]?.id, "finding-1");
    const volume = next[0]?.claims.find((row) => row.fieldId === "feedstock_volume");
    const timeline = next[0]?.claims.find((row) => row.fieldId === "timeline");
    assert.equal(volume?.decision, "confirmed");
    assert.equal(timeline?.decision, undefined);
  });
});
