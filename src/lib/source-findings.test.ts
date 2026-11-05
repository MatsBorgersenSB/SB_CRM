import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  appendSourceFinding,
  createSourceFinding,
  extractDocumentMetadataClaims,
  extractSourceFindingPreview,
  type SourceFinding,
  type SourceFindingClaim,
} from "./source-findings";
import { patchSourceFindings } from "./opportunity-understanding-model";

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

  it("extracts structured claims from documents, drawings, permits, presentations, and pictures", () => {
    const permitClaims = extractDocumentMetadataClaims({
      name: "PL-1044-G-GEN-0001 142236 Tillatelse (1).pdf",
      docCategory: "Quality",
      docType: "Certificate",
      origin: "external",
    });
    assert.equal(permitClaims[0]?.fieldId, "permitting");
    assert.match(permitClaims[0]?.statement ?? "", /142236/);

    const flowClaims = extractDocumentMetadataClaims({
      name: "PL-1044-T-PSU-0002 2026 02 26 Flow diagram Antec.pdf",
      docCategory: "Engineering",
      docType: "Drawing",
      origin: "external",
    });
    assert.equal(flowClaims[0]?.fieldId, "technical_fit");

    const imageClaims = extractDocumentMetadataClaims({
      name: "IO-Link Reactor.png",
      mimeType: "image/png",
      origin: "external",
      counterparty: "Guard Automation",
    });
    assert.equal(imageClaims[0]?.fieldId, "technical_fit");
    assert.match(imageClaims[0]?.statement ?? "", /Guard Automation/);
  });

  it("extracts subsupplier feedstock terms and client site confirmations from correspondence", () => {
    const subsupplierMail = extractSourceFindingPreview(
      "SV: Hornindal - G30 Tørket flis - 8 000 til 10 000 t/år\nHvilket krav til fukt % er det på leveransen og hvor stor lagerplass er planlagt tilgjengelig?",
      "/opportunities/PL-1044?view=actions&action=emails",
      "Subsupplier mail (allskog.no)",
    );
    const feedstockClaim = subsupplierMail.claims.find(
      (c) => c.fieldId === "feedstock_agreement",
    );
    assert.ok(feedstockClaim);
    assert.match(feedstockClaim.statement, /8 000 til 10 000 t\/år G30 wood chips/);
    assert.match(feedstockClaim.statement, /moisture %/i);

    const clientMail = extractSourceFindingPreview(
      "Jeg har nå hatt en prat med Erik. Han bekrefter at det er nok plass på anlegget til Vest Biogass til et pyrolyseanlegg.",
      "/opportunities/PL-1044?view=actions&action=emails",
      "Client mail",
    );
    assert.ok(clientMail.claims.some((c) => c.fieldId === "site_readiness"));
  });

  it("keeps document, picture, email, and activity findings even when a field already has a rough note, and appends newly confirmed evidence", () => {
    const docFinding = createSourceFinding({
      title: "142236 Tillatelse (1)",
      kind: "document",
      note: "PL-1044-G-GEN-0001 142236 Tillatelse (1).pdf",
      claims: [
        claim(
          "doc-permitting",
          "Permit / certificate filed on record: “142236 Tillatelse (1)” (ref. 142236).",
          "permitting",
        ),
      ],
    });

    const appended = appendSourceFinding([], docFinding, ["permitting"]);
    assert.equal(appended.length, 1);
    assert.equal(appended[0]?.claims.length, 1);

    const confirmed = [
      {
        ...appended[0]!,
        claims: appended[0]!.claims.map((c) => ({ ...c, decision: "confirmed" as const })),
      },
    ];
    const updated = patchSourceFindings(
      {
        fields: { permitting: "Antec holds the biogas plant permit." },
        findings: appended,
      },
      confirmed,
    );
    assert.match(updated.fields.permitting ?? "", /Antec holds the biogas plant permit/);
    assert.match(updated.fields.permitting ?? "", /142236 Tillatelse/);
  });
});
