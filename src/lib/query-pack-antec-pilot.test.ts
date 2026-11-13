import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applySourceFindingDecision } from "@/lib/source-findings";
import {
  acceptAnswerProposals,
  antecHornindalSeedPositions,
  assignPositionCompany,
  createQueryPack,
  mergeAcceptedQueryPackFinding,
  rowsForCompanyExport,
} from "@/lib/query-pack";
import { buildQueryPackXlsx, parseQueryPackXlsx } from "@/lib/query-pack-excel";

/**
 * Antec Hornindal pilot simulation (FS-024 §9).
 * Uses a fixture roster company id only — does not invent CRM companies/contacts.
 */
describe("Antec Hornindal query pack pilot", () => {
  it("seed → assign roster id → export → answer → import → accept → finding", async () => {
    const rosterCompanyId = "roster-vest-biogas";
    const rosterCompanyTitle = "Vest Biogas";

    let pack = createQueryPack({
      scope: "opportunity",
      scopeId: "PL-ANTEC-HORNINDAL",
      title: "Antec Hornindal — commercial & technical queries",
      positions: antecHornindalSeedPositions(),
    });

    for (const questionId of [
      "ANTEC-SEED-01",
      "ANTEC-SEED-02",
      "ANTEC-SEED-03",
      "ANTEC-SEED-04",
    ]) {
      pack = assignPositionCompany(pack, questionId, {
        companyId: rosterCompanyId,
        companyTitle: rosterCompanyTitle,
      });
    }

    const exportRows = rowsForCompanyExport(pack, rosterCompanyId);
    assert.equal(exportRows.length, 4);
    assert.ok(exportRows.every((row) => row.companyId === rosterCompanyId));
    assert.equal(
      rowsForCompanyExport(pack, "some-other-roster").length,
      0,
    );

    const answered = exportRows.map((row) =>
      row.questionId === "ANTEC-SEED-01"
        ? { ...row, answer: "Lease preferred; term not yet agreed" }
        : row.questionId === "ANTEC-SEED-03"
          ? { ...row, answer: "Hot water ~90C; volume and price still open" }
          : row,
    );

    const bytes = await buildQueryPackXlsx(answered, {
      packId: pack.packId,
      scopeId: pack.scopeId,
      scopeTitle: pack.title,
      issuedAt: "2026-11-13",
    });
    const buffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    const imported = await parseQueryPackXlsx(pack, buffer);
    assert.equal(imported.unmatched.length, 0);
    assert.equal(imported.proposals.length, 2);

    const { pack: nextPack, finding } = acceptAnswerProposals(pack, imported.proposals, {
      sourceFileName: "vest-biogas-queries.xlsx",
      companyId: rosterCompanyId,
    });
    assert.equal(finding.kind, "document");
    assert.match(finding.title, /Vest Biogas/);

    let understanding = mergeAcceptedQueryPackFinding(undefined, nextPack, finding);
    const claimId = finding.claims[0]?.id;
    assert.ok(claimId);
    understanding = {
      ...understanding,
      findings: applySourceFindingDecision(understanding.findings, finding.id, claimId!, "confirmed"),
    };

    const confirmed = understanding.findings?.[0]?.claims.find((claim) => claim.id === claimId);
    assert.equal(confirmed?.decision, "confirmed");
    assert.equal(
      understanding.queryPack?.positions.find((row) => row.questionId === "ANTEC-SEED-01")?.answer,
      "Lease preferred; term not yet agreed",
    );
    assert.ok(
      understanding.queryPack?.positions.some(
        (row) => row.questionId === "ANTEC-SEED-02" && row.status === "open",
      ),
    );
  });
});
