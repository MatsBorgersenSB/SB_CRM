import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyByFileName } from "./mock-ai-parser";

describe("classifyByFileName", () => {
  it("treats a Standard Bio mulighetsstudie as a feasibility study", () => {
    const result = classifyByFileName(
      "Vest Biogass - StandardBio - Mulighetsstudie.docx",
    );
    assert.equal(result.DocType, "Report");
    assert.equal(result.DocCategory, "Engineering");
    assert.equal(result.reason, "Filename indicates a feasibility study");
    assert.notEqual(result.DocType, "NDA");
  });

  it("still recognises a real NDA filename", () => {
    const result = classifyByFileName("Vest Biogass - Standard Bio NDA.docx");
    assert.equal(result.DocType, "NDA");
    assert.equal(result.reason, "Filename indicates a non-disclosure agreement");
  });
});
