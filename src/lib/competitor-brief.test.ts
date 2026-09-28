import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  competitorSearchNames,
  extractCompetitorBriefClaims,
  findCompetitorDealOverlap,
  hasConfirmedCompetitorKnowledge,
} from "./competitor-brief";
import type { SourceFinding } from "./source-findings";

describe("competitor brief — high value only", () => {
  it("strips legal suffixes so MAVITEC B.V. is searchable as Mavitec", () => {
    const names = competitorSearchNames("MAVITEC B.V.");
    assert.ok(names.includes("mavitec"));
    assert.ok(!names.some((name) => name === "b.v." || name === "bv"));
  });

  it("extracts offer and feedstock from a pyrolysis equipment page, not slogans", () => {
    const claims = extractCompetitorBriefClaims({
      companyName: "MAVITEC B.V.",
      htmlOrText: `
        <h1>Innovative sustainable solutions for a better world</h1>
        <p>Mavitec Environmental supplies pyrolysis equipment and rendering systems
        for animal by-products and manure, producing biochar.</p>
        <p>We are a leading global provider of circular technology.</p>
      `,
      overlap: [],
    });
    const statements = claims.map((row) => row.statement).join(" ");
    assert.ok(/pyrolysis/i.test(statements));
    assert.ok(/animal by-products|manure/i.test(statements));
    assert.ok(!/leading global provider/i.test(statements));
    assert.ok(!/innovative sustainable/i.test(statements));
    assert.ok(claims.length <= 5);
    assert.ok(claims.every((row) => row.impact.trim().length > 0));
    assert.ok(
      claims.every((row) => !/customer conversation|brief a customer|in the room/i.test(row.impact)),
    );
  });

  it("treats gasification as a real offer and strips sentence-runon geography", () => {
    const claims = extractCompetitorBriefClaims({
      companyName: "MAVITEC B.V.",
      htmlOrText: `
        We design, build & service Gasification solutions for manure.
        Mavitec Rendering Complete systems & equipment for rendering animal by-products.
        Gasifier installation in Middle East For a well-respected customer.
      `,
      overlap: [],
    });
    const statements = claims.map((row) => row.statement).join(" | ");
    assert.match(statements, /gasification/i);
    assert.ok(!/Middle East For/i.test(statements));
    assert.match(statements, /installation in Middle East/i);
  });

  it("puts named deal overlap first", () => {
    const claims = extractCompetitorBriefClaims({
      companyName: "MAVITEC B.V.",
      overlap: [{ dealId: "PL-1", dealName: "Nordic manure plant" }],
    });
    assert.equal(claims[0]?.id, "overlap-PL-1");
    assert.match(claims[0]?.statement ?? "", /Nordic manure plant/);
  });

  it("does not invent facts from a slogan page", () => {
    const claims = extractCompetitorBriefClaims({
      companyName: "Acme",
      sourceUrl: "https://acme.example",
      htmlOrText: "<p>We are a leading global provider of innovative sustainable solutions.</p>",
      overlap: [],
    });
    assert.equal(claims.length, 1);
    assert.equal(claims[0]?.id, "unknown");
  });

  it("finds the competitor name on another company's deal", () => {
    const overlap = findCompetitorDealOverlap(
      [
        {
          id: "d1",
          assetName: "City heat project — Mavitec also quoted",
          ClientLookup: "CO-other",
        },
        {
          id: "d2",
          assetName: "Internal note",
          ClientLookup: "CO-1026",
        },
      ],
      { CompanyID: "CO-1026", Title: "MAVITEC B.V." },
    );
    assert.equal(overlap.length, 1);
    assert.equal(overlap[0]?.dealId, "d1");
  });

  it("treats slogans-as-confirmed-unknown as not yet knowledge", () => {
    const findings: SourceFinding[] = [
      {
        id: "f1",
        title: "scan",
        addedAt: "2026-01-01",
        kind: "competitor",
        claims: [
          {
            id: "unknown",
            statement: "No fact",
            impact: "Need more",
            decision: "confirmed",
          },
        ],
      },
    ];
    assert.equal(hasConfirmedCompetitorKnowledge(findings), false);
  });
});
