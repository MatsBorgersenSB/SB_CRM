import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assignPositionCompany,
  antecHornindalSeedPositions,
  createQueryPack,
  rowsForCompanyExport,
} from "@/lib/query-pack";
import { buildQueryPackXlsx, parseQueryPackXlsx } from "@/lib/query-pack-excel";

describe("query-pack excel", () => {
  it("round-trips QuestionId and Answer", async () => {
    let pack = createQueryPack({
      scope: "opportunity",
      scopeId: "PL-ANTEC",
      title: "Antec queries",
      positions: antecHornindalSeedPositions(),
    });
    pack = assignPositionCompany(pack, "ANTEC-SEED-01", {
      companyId: "roster-vest",
      companyTitle: "Vest Biogas",
    });
    const positions = rowsForCompanyExport(pack, "roster-vest").map((row) => ({
      ...row,
      answer: "Lease under discussion",
    }));
    const bytes = await buildQueryPackXlsx(positions, {
      packId: pack.packId,
      scopeId: pack.scopeId,
      scopeTitle: "Antec - Hornindal",
      issuedAt: "2026-11-13",
    });
    const copy = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    const result = await parseQueryPackXlsx(pack, copy);
    assert.equal(result.unmatched.length, 0);
    assert.equal(result.proposals.length, 1);
    assert.equal(result.proposals[0]?.questionId, "ANTEC-SEED-01");
    assert.equal(result.proposals[0]?.nextAnswer, "Lease under discussion");
  });
});
