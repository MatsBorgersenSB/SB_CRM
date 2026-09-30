import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildProjectSmartDocIdentityPreview,
  normalizeSmartDocOwnerCode,
  parseSmartDocIdentity,
  parseSmartDocIdentityFromFileName,
} from "./smartdoc-identity";

describe("SmartDoc identity — hyphenated project codes", () => {
  it("accepts PRJ-CARBON-EMERGENTE as an owner code", () => {
    assert.equal(
      normalizeSmartDocOwnerCode("PRJ-CARBON-EMERGENTE"),
      "PRJ-CARBON-EMERGENTE",
    );
  });

  it("builds and parses Escalante identity without swallowing the project name", () => {
    const preview = buildProjectSmartDocIdentityPreview(
      "PRJ-CARBON-EMERGENTE",
      "Escalante",
      "Project Management",
      "Minutes og Meeting",
      [],
    );
    assert.equal(preview.documentId, "PRJ-CARBON-EMERGENTE-P-MM-0001");
    const parsed = parseSmartDocIdentity(preview.documentId);
    assert.equal(parsed?.ownerCode, "PRJ-CARBON-EMERGENTE");
    assert.equal(parsed?.ownership, "project");
    assert.equal(parsed?.categoryCode, "P");
    assert.equal(parsed?.typeCode, "MM");
  });

  it("reads identity from a SharePoint file name", () => {
    const parsed = parseSmartDocIdentityFromFileName(
      "PRJ-CARBON-EMERGENTE-P-MM-0001 Minutes of meeting.pdf",
    );
    assert.equal(parsed?.ownerCode, "PRJ-CARBON-EMERGENTE");
    assert.equal(parsed?.ownership, "project");
  });

  it("still parses opportunity and company identities", () => {
    assert.equal(parseSmartDocIdentity("PL-1031-S-QUO-0001")?.ownership, "opportunity");
    assert.equal(parseSmartDocIdentity("CO-1009-S-SUQ-0001")?.ownership, "company");
  });
});
