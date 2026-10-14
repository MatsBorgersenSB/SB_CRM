import assert from "node:assert/strict";
import test from "node:test";
import { parseExploreIntent } from "@/lib/smartassist/explore/intent";

test("explore intent: company lookups", () => {
  assert.deepEqual(parseExploreIntent("Explore Romerike Biogass"), {
    kind: "company",
    subject: "Romerike Biogass",
  });
  assert.deepEqual(parseExploreIntent("explore Romerike biogass (business intelligence)"), {
    kind: "company",
    subject: "Romerike biogass",
  });
  assert.deepEqual(parseExploreIntent("What do we know about Tomra Systems ASA?"), {
    kind: "company",
    subject: "Tomra Systems ASA",
  });
  assert.deepEqual(parseExploreIntent("Who is Biogass Norge"), {
    kind: "company",
    subject: "Biogass Norge",
  });
  // A bare name is a lookup.
  assert.deepEqual(parseExploreIntent("Romerike Biogassanlegg AS"), {
    kind: "company",
    subject: "Romerike Biogassanlegg AS",
  });
});

test("explore intent: supplier discovery is recognised, with commodity and region", () => {
  assert.deepEqual(
    parseExploreIntent("explore G30 wood chip sources in the region of Hornindal"),
    { kind: "suppliers", commodity: "G30 wood chip", region: "Hornindal" },
  );
  assert.deepEqual(parseExploreIntent("Find potential suppliers of sawdust near Volda"), {
    kind: "suppliers",
    commodity: "sawdust",
    region: "Volda",
  });
});

test("explore intent: regulatory questions are not treated as companies", () => {
  const intent = parseExploreIntent(
    "What is maximum content of plastics in digestate fertiliser in Norway?",
  );
  assert.equal(intent?.kind, "regulation");
});

test("explore intent: portfolio questions are left to the ask engine", () => {
  assert.equal(parseExploreIntent("Which opportunities need attention?"), null);
  assert.equal(parseExploreIntent("What changed this week?"), null);
  assert.equal(parseExploreIntent(""), null);
});
