import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildProjectDocumentContext } from "./smartdoc-library-engine";

describe("project SmartDoc context", () => {
  it("accepts hyphenated Escalante id PRJ-CARBON-EMERGENTE", () => {
    const context = buildProjectDocumentContext(
      { id: "PRJ-CARBON-EMERGENTE", name: "Escalante", linkedCompanyId: "CO-1" },
      { CompanyID: "CO-1", Title: "Carbón Emergente" } as never,
    );
    assert.equal(context.projectCode, "PRJ-CARBON-EMERGENTE");
    assert.equal(context.sharePointFolderPath, "/Projects/Carbón Emergente/Escalante");
  });

  it("rejects a project without a PRJ- id", () => {
    assert.throws(
      () => buildProjectDocumentContext({ id: "Escalante", name: "Escalante" }),
      /missing a PRJ/,
    );
  });
});
