import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  acceptAnswerProposals,
  addQueryAttachment,
  addQueryPosition,
  antecHornindalSeedPositions,
  assignPositionCompany,
  createQueryPack,
  diffImportAnswers,
  formatAttachmentsForExcel,
  mergeAcceptedQueryPackFinding,
  removeQueryAttachment,
  rowsForCompanyExport,
  updateQueryPosition,
} from "@/lib/query-pack";

describe("query-pack domain", () => {
  it("creates a draft pack for an opportunity", () => {
    const pack = createQueryPack({
      scope: "opportunity",
      scopeId: "PL-ANTEC",
      title: "Antec Hornindal — commercial & technical queries",
    });
    assert.equal(pack.status, "draft");
    assert.equal(pack.scopeId, "PL-ANTEC");
    assert.ok(pack.packId.startsWith("QP-"));
  });

  it("adds a user-written question", () => {
    const pack = createQueryPack({
      scope: "project",
      scopeId: "PRJ-ANTEC-HORNINDAL",
      title: "Ask the companies",
    });
    const next = addQueryPosition(pack, {
      type: "commercial",
      question: "What lease term is acceptable for the land plot?",
      company: { companyId: "roster-antec", companyTitle: "ANTEC BIOGAS AS" },
    });
    assert.equal(next.positions.length, 1);
    assert.match(next.positions[0]!.questionId, /^Q-/);
    assert.equal(next.positions[0]!.companyId, "roster-antec");
  });

  it("updates an existing question from the form card", () => {
    let pack = createQueryPack({
      scope: "project",
      scopeId: "PRJ-ANTEC-HORNINDAL",
      title: "Ask the companies",
    });
    pack = addQueryPosition(pack, {
      type: "commercial",
      question: "Old wording",
      company: { companyId: "roster-antec", companyTitle: "ANTEC BIOGAS AS" },
    });
    const questionId = pack.positions[0]!.questionId;
    pack = updateQueryPosition(pack, questionId, {
      type: "technical",
      question: "Updated wording",
      company: { companyId: "roster-allskog", companyTitle: "Allskog" },
      contact: { contactTitle: "Site lead" },
      responseRequiredBy: "2026-12-01",
    });
    assert.equal(pack.positions[0]!.questionId, questionId);
    assert.equal(pack.positions[0]!.type, "technical");
    assert.equal(pack.positions[0]!.question, "Updated wording");
    assert.equal(pack.positions[0]!.companyId, "roster-allskog");
    assert.equal(pack.positions[0]!.contactTitle, "Site lead");
    assert.equal(pack.positions[0]!.responseRequiredBy, "2026-12-01");
  });

  it("attaches document url and picture link to a question", () => {
    let pack = createQueryPack({
      scope: "project",
      scopeId: "PRJ-ANTEC-HORNINDAL",
      title: "Ask the companies",
      positions: antecHornindalSeedPositions().slice(0, 1),
    });
    const questionId = pack.positions[0]!.questionId;
    pack = addQueryAttachment(pack, questionId, {
      kind: "document",
      label: "Site sketch",
      url: "https://contoso.sharepoint.com/sites/x/Shared%20Documents/sketch.pdf",
    });
    pack = addQueryAttachment(pack, questionId, {
      kind: "url",
      label: "Map",
      url: "https://example.com/map",
    });
    assert.equal(pack.positions[0]!.attachments?.length, 2);
    assert.match(
      formatAttachmentsForExcel(pack.positions[0]!.attachments),
      /document:Site sketch/,
    );
    const attachmentId = pack.positions[0]!.attachments![0]!.id;
    pack = removeQueryAttachment(pack, questionId, attachmentId);
    assert.equal(pack.positions[0]!.attachments?.length, 1);
  });

  it("seeds Antec unknowns from FS-005B only", () => {
    const seeds = antecHornindalSeedPositions();
    assert.deepEqual(
      seeds.map((row) => row.questionId),
      [
        "ANTEC-SEED-01",
        "ANTEC-SEED-02",
        "ANTEC-SEED-03",
        "ANTEC-SEED-04",
        "ANTEC-SEED-05",
      ],
    );
    assert.ok(seeds.every((row) => !row.companyId));
  });

  it("exports only the assigned company rows", () => {
    let pack = createQueryPack({
      scope: "opportunity",
      scopeId: "PL-ANTEC",
      title: "Queries",
      positions: antecHornindalSeedPositions(),
    });
    pack = assignPositionCompany(pack, "ANTEC-SEED-01", {
      companyId: "roster-vest",
      companyTitle: "Vest Biogas",
    });
    pack = assignPositionCompany(pack, "ANTEC-SEED-02", {
      companyId: "roster-vest",
      companyTitle: "Vest Biogas",
    });
    pack = assignPositionCompany(pack, "ANTEC-SEED-05", {
      companyId: "roster-other",
      companyTitle: "Other Roster Co",
    });

    const vest = rowsForCompanyExport(pack, "roster-vest");
    assert.equal(vest.length, 2);
    assert.ok(vest.every((row) => row.companyId === "roster-vest"));
    assert.equal(rowsForCompanyExport(pack, "roster-other").length, 1);
  });

  it("never auto-matches import rows without QuestionId", () => {
    const pack = createQueryPack({
      scope: "opportunity",
      scopeId: "PL-ANTEC",
      title: "Queries",
      positions: antecHornindalSeedPositions(),
    });
    const result = diffImportAnswers(pack, [
      { questionId: "", answer: "Lease terms TBD", comment: "", answeredAt: "" },
      { questionId: "ANTEC-SEED-01", answer: "Lease preferred", comment: "", answeredAt: "" },
    ]);
    assert.equal(result.unmatched.length, 1);
    assert.match(result.unmatched[0]!.reason, /Missing QuestionId/);
    assert.equal(result.proposals.length, 1);
    assert.equal(result.proposals[0]!.questionId, "ANTEC-SEED-01");
  });

  it("accept builds document finding with optional fieldId and merges into understanding", () => {
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
    const proposals = diffImportAnswers(pack, [
      {
        questionId: "ANTEC-SEED-01",
        answer: "Lease for 15 years under discussion",
        comment: "",
        answeredAt: "",
      },
    ]).proposals;

    const { pack: nextPack, finding } = acceptAnswerProposals(pack, proposals, {
      sourceFileName: "vest-queries.xlsx",
    });
    assert.equal(finding.kind, "document");
    assert.equal(finding.claims[0]?.fieldId, "site_readiness");
    assert.equal(finding.claims[0]?.decision, undefined);
    assert.equal(
      nextPack.positions.find((row) => row.questionId === "ANTEC-SEED-01")?.status,
      "answered",
    );

    const merged = mergeAcceptedQueryPackFinding(undefined, nextPack, finding);
    assert.equal(merged.queryPack?.packId, nextPack.packId);
    assert.equal(merged.findings?.length, 1);
  });
});
