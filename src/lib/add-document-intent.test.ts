import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { documentsUrlForCompany, documentsUrlForPath } from "./add-document-intent";

describe("documentsUrlForPath", () => {
  it("jumps to the documents section on company and contact pages", () => {
    assert.equal(documentsUrlForPath("/companies/CO-1"), "/companies/CO-1#documents");
    assert.equal(documentsUrlForPath("/contacts/abc"), "/contacts/abc#documents");
  });

  it("opens the documents tab on opportunity and project pages", () => {
    assert.equal(
      documentsUrlForPath("/opportunities/xyz"),
      "/opportunities/xyz?view=actions&action=documents",
    );
    assert.equal(
      documentsUrlForPath("/projects/p1"),
      "/projects/p1?view=actions&action=documents",
    );
  });

  it("returns null when no record is open", () => {
    assert.equal(documentsUrlForPath("/"), null);
    assert.equal(documentsUrlForPath("/companies"), null);
    assert.equal(documentsUrlForPath("/knowledge"), null);
  });
});

describe("documentsUrlForCompany", () => {
  it("encodes the company id", () => {
    assert.equal(documentsUrlForCompany("CO 1"), "/companies/CO%201#documents");
  });
});
