import assert from "node:assert/strict";
import test from "node:test";
import {
  isHostPlantClaim,
  linkedWorkByPillar,
  pillarForText,
} from "./development-pillars";

test("host plant facts are not evidence for our steps", () => {
  assert.equal(isHostPlantClaim("The site is named in the source (Raudemel / Volda)."), true);
  assert.equal(isHostPlantClaim("The source indicates gas offtake or an LBG path."), true);
  assert.equal(isHostPlantClaim("Reported outputs: LBG, digestate."), true);
  assert.equal(isHostPlantClaim("Reported plant volume: 150 000 tonn."), true);
  assert.equal(
    isHostPlantClaim("Client confirmed sufficient plot space at the biogas plant for a pyrolysis installation."),
    false,
  );
  assert.equal(
    isHostPlantClaim("Biochar product offtake dialogue initiated with TerraMarine."),
    false,
  );
});

test("each piece of work lands under exactly one step", () => {
  assert.equal(pillarForText("Deliver pyrolysis plant layout drawing on ~80x120 m² plot"), "site_readiness");
  assert.equal(pillarForText("Confirm utility capacity data with Vest Biogass"), "utilities");
  assert.equal(pillarForText("Specify G30 wood chip moisture % and tipping layout"), "feedstock_agreement");
  assert.equal(pillarForText("Follow up TerraMarine on activated biochar quality spec"), "end_product");
  // Touches two steps -> not guessed.
  assert.equal(pillarForText("Apply for permit and grant"), null);
  assert.equal(pillarForText("Send the weekly update"), null);
});

test("land plot step only receives land plot work", () => {
  const grouped = linkedWorkByPillar(
    [
      { id: "m1", title: "Confirm utility capacity data", owner: "A", status: "planned", targetDate: "2026-11-11" },
      { id: "m2", title: "Deliver layout drawing on plot", owner: "B", status: "planned", targetDate: "2026-11-18" },
    ] as never,
    [
      {
        id: "d1",
        decision: "Site footprint approved during site visit; lease vs. purchase terms to be secured.",
        date: "2026-11-03",
        owner: "C",
      },
    ],
  );
  assert.deepEqual(grouped.site_readiness?.map((i) => i.id), ["m2", "d1"]);
  assert.deepEqual(grouped.utilities?.map((i) => i.id), ["m1"]);
});
