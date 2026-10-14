import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  marketFactsForDeal,
  resolveMarketFacts,
  searchMarketFacts,
} from "./market-facts";

const confirmed = resolveMarketFacts({
  "dk-soil-storage-aid": "confirmed",
  "dk-bid-cap": "confirmed",
  "eu-biochar-certification": "confirmed",
  "se-sewage-sludge": "confirmed",
  "se-metallurgical-biocarbon": "confirmed",
  "eu-few-furnaces": "confirmed",
});

describe("market facts", () => {
  it("returns Danish aid for a Danish biochar question and leaves Sweden out", () => {
    const result = searchMarketFacts("Danish biochar aid", confirmed);
    assert.deepEqual(
      result.confirmed.map((fact) => fact.id),
      ["dk-soil-storage-aid", "dk-bid-cap"],
    );
    assert.equal(result.pending.length, 0);
  });

  it("holds an unconfirmed card out of the answer", () => {
    const facts = resolveMarketFacts({});
    const result = searchMarketFacts("Danish biochar aid", facts);
    assert.equal(result.confirmed.length, 0);
    assert.equal(result.pending[0]?.id, "dk-soil-storage-aid");
  });

  it("shows Europe cards on a Norwegian deal and withholds the Danish aid", () => {
    const rows = marketFactsForDeal(confirmed, {
      country: "Norway",
      feedstock: "forest residue",
      industry: "Energy",
    });
    const ids = rows.map((fact) => fact.id);
    assert.ok(ids.includes("eu-biochar-certification"));
    assert.ok(ids.includes("eu-few-furnaces"));
    assert.ok(!ids.includes("dk-soil-storage-aid"));
    assert.ok(!ids.includes("se-sewage-sludge"));
  });

  it("shows the sludge card only when the Swedish deal is about sludge", () => {
    const metal = marketFactsForDeal(confirmed, {
      country: "Sweden",
      feedstock: "forest residue",
      industry: "Metals & Mining",
    });
    assert.ok(metal.some((fact) => fact.id === "se-metallurgical-biocarbon"));
    assert.ok(!metal.some((fact) => fact.id === "se-sewage-sludge"));

    const sludge = marketFactsForDeal(confirmed, {
      country: "Sweden",
      feedstock: "sewage sludge",
      industry: "Utilities",
    });
    assert.ok(sludge.some((fact) => fact.id === "se-sewage-sludge"));
    assert.ok(sludge.some((fact) => fact.id === "dk-soil-storage-aid") === false);
  });
});
