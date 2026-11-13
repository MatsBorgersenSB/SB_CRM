import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDocumentLocationTrail,
  documentHrefWithLocation,
  documentLocationFromWorkspace,
  documentLocationReturnHref,
  parseDocumentLocationFrom,
  withDocumentLocationFrom,
} from "./document-location";

describe("document location continuity", () => {
  it("parses from=contact with company", () => {
    const from = parseDocumentLocationFrom(
      new URLSearchParams("from=contact&contactId=CT-1&companyId=CO-1009"),
    );
    assert.deepEqual(from, {
      scope: "contact",
      companyId: "CO-1009",
      contactId: "CT-1",
      dealId: undefined,
      projectId: undefined,
    });
  });

  it("rejects incomplete from scopes", () => {
    assert.equal(
      parseDocumentLocationFrom(new URLSearchParams("from=company")),
      null,
    );
    assert.equal(
      parseDocumentLocationFrom(new URLSearchParams("from=opportunity")),
      null,
    );
  });

  it("builds document href with from params", () => {
    const href = documentHrefWithLocation("CO-1009-S-SUQ-0001", {
      scope: "contact",
      contactId: "CT-1",
      companyId: "CO-1009",
    });
    assert.ok(href.startsWith("/documents/CO-1009-S-SUQ-0001?"));
    const params = new URL(href, "https://x").searchParams;
    assert.equal(params.get("from"), "contact");
    assert.equal(params.get("contactId"), "CT-1");
    assert.equal(params.get("companyId"), "CO-1009");
  });

  it("returns contact to contact documents, not company", () => {
    const href = documentLocationReturnHref({
      scope: "contact",
      contactId: "CT-1",
      companyId: "CO-1009",
    });
    assert.ok(href.startsWith("/contacts/CT-1"));
    assert.ok(href.includes("company=CO-1009"));
    assert.ok(href.endsWith("#documents"));
  });

  it("falls back to owner documents when from is missing", () => {
    assert.equal(
      documentLocationReturnHref(null, {
        ownershipKind: "company",
        companyId: "CO-1009",
      }),
      "/companies/CO-1009#documents",
    );
    assert.equal(
      documentLocationReturnHref(null, {
        ownershipKind: "opportunity",
        dealId: "PL-1",
      }),
      "/opportunities/PL-1?view=work#documents",
    );
  });

  it("builds trail labels without inventing names", () => {
    const trail = buildDocumentLocationTrail({
      from: { scope: "contact", contactId: "CT-1", companyId: "CO-1" },
      labels: { contactName: "Ada Lovelace", companyName: "DorsetGM" },
      ownershipKind: "company",
    });
    assert.equal(trail.backLabel, "Back to Ada Lovelace · Documents");
    assert.equal(trail.scopeLabel, "Contact");
    assert.equal(trail.ownershipLabel, "Owned by company · DorsetGM");
    assert.ok(trail.href.includes("/contacts/CT-1"));
  });

  it("maps workspace context into from", () => {
    assert.deepEqual(
      documentLocationFromWorkspace({
        scope: "opportunity",
        dealId: "PL-9",
        companyId: "CO-1",
      }),
      {
        scope: "opportunity",
        dealId: "PL-9",
        companyId: "CO-1",
      },
    );
  });

  it("preserves existing tab query when appending from", () => {
    const href = withDocumentLocationFrom("/documents/X?tab=linked", {
      scope: "project",
      projectId: "PRJ-1",
    });
    const params = new URL(href, "https://x").searchParams;
    assert.equal(params.get("tab"), "linked");
    assert.equal(params.get("from"), "project");
    assert.equal(params.get("projectId"), "PRJ-1");
  });
});
