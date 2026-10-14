import assert from "node:assert/strict";
import test from "node:test";
import {
  exploreCompany,
  normalizeCompanyName,
  type ExploreDeps,
} from "@/lib/smartassist/explore/company-explore";
import type { UnifiedEuropeanCompany } from "@/lib/integrations/company-registers/types";
import type { Company } from "@/types/company";

const romerike: UnifiedEuropeanCompany = {
  legalName: "ROMERIKE BIOGASSANLEGG AS",
  registrationNumber: "936106978",
  country: "Norge",
  countryCode: "NO",
  continent: "Europe",
  postalCode: "2160",
  city: "VORMSUND",
  industryCode: "35.210",
  industryDescription: "Produksjon av gass",
  sourceRegistry: "Brønnøysundregistrene (NO)",
};

const biogassNorge: UnifiedEuropeanCompany = {
  ...romerike,
  legalName: "BIOGASS NORGE",
  registrationNumber: "921694784",
  city: "OSLO",
  website: "www.biogassnorge.no",
};

function deps(overrides: Partial<ExploreDeps> = {}): ExploreDeps {
  return {
    searchRegistry: async () => [romerike, biogassNorge],
    fetchOfficers: async () => [{ name: "Antoine Michel Philippe Forcinal", role: "Styrets leder" }],
    discoverWebsite: async () => null,
    searchInternal: async () => [],
    ...overrides,
  };
}

test("normalizeCompanyName drops legal suffixes and punctuation", () => {
  assert.equal(normalizeCompanyName("Romerike Biogassanlegg AS"), "romerike biogassanlegg");
  assert.equal(normalizeCompanyName("TOMRA SYSTEMS ASA."), "tomra systems");
});

test("a new company: register identity, leadership, honest unknowns, import allowed as Unclassified", async () => {
  const result = await exploreCompany(
    { question: "Explore Romerike Biogass", subject: "Romerike Biogass", companies: [] },
    deps(),
  );

  assert.equal(result.found.registry?.registrationNumber, "936106978");
  assert.equal(result.found.alternatives.length, 0, "Biogass Norge is not a near-name of Romerike Biogass");
  assert.equal(result.found.people.length, 1);
  assert.equal(result.found.people[0]?.role, "Styrets leder");
  assert.equal(result.found.people[0]?.email, null);
  assert.match(result.summary, /registered Norwegian company/);
  assert.match(result.summary, /Not in SmartCRM yet/);
  assert.ok(result.unknown.some((u) => /register lists no website/.test(u)));
  assert.ok(result.unknown.some((u) => /no email or phone/.test(u)));
  assert.ok(result.unknown.some((u) => /No correspondence/.test(u)));
  assert.equal(result.next.canImport, true);
  assert.equal(result.next.defaultType, "Unclassified");
  assert.ok(result.sources.some((s) => s.kind === "registry" && s.url?.includes("936106978")));
  // Every fact cites a source we listed.
  for (const fact of result.found.facts) {
    assert.ok(result.sources.some((s) => s.id === fact.sourceId), `fact without source: ${fact.text}`);
  }
});

test("a company we already hold: no import, open link instead", async () => {
  const held = {
    CompanyID: "CO-1007",
    code: "CO-1007",
    Title: "Romerike Biogassanlegg AS",
    Domain: "",
    organizationNumber: "936106978",
    CompanyTypes: ["Prospect"],
    contacts: [{}, {}],
    pipelineIds: ["d1"],
  } as unknown as Company;

  const result = await exploreCompany(
    { question: "Romerike Biogass", subject: "Romerike Biogass", companies: [held] },
    deps(),
  );

  assert.equal(result.known.companies.length, 1);
  assert.match(result.summary, /already in SmartCRM \(Prospect\) with 2 contacts and 1 opportunity/);
  assert.equal(result.next.canImport, false);
  assert.ok(result.next.openHref?.includes("CO-1007"));
});

test("nothing found anywhere: says so, asks for a website, no import", async () => {
  const result = await exploreCompany(
    { question: "Explore Nonexistent Widgets", subject: "Nonexistent Widgets", companies: [] },
    deps({ searchRegistry: async () => [], fetchOfficers: async () => [] }),
  );

  assert.match(result.summary, /Nothing in SmartCRM or the public registers matches/);
  assert.equal(result.found.registry, null);
  assert.equal(result.next.canImport, false);
  assert.ok(result.unknown.some((u) => /legal identity is unconfirmed/.test(u)));
});

test("website people and register officers merge by name; website details win", async () => {
  const result = await exploreCompany(
    { question: "Explore Biogass Norge", subject: "Biogass Norge", companies: [] },
    deps({
      searchRegistry: async () => [biogassNorge],
      fetchOfficers: async () => [{ name: "Kari Nordmann", role: "Daglig leder" }],
      discoverWebsite: async (url) => ({
        sourceUrl: url,
        company: {
          name: "Biogass Norge",
          phone: "+47 22 00 00 00",
          email: "post@biogassnorge.no",
          website: "biogassnorge.no",
          address: "Oslo",
          domain: "biogassnorge.no",
          streetAddress: "",
          postalCode: "",
          city: "Oslo",
          stateRegion: "",
          country: "Norway",
          countryCode: "NO",
          continent: "Europe",
        },
        contacts: [
          { id: "c1", name: "Kari Nordmann", jobTitle: "", email: "kari@biogassnorge.no", phone: "" },
        ],
        matchedCompanyId: null,
        matchedCompanyName: null,
        pagesAnalyzed: ["https://www.biogassnorge.no"],
      }),
    }),
  );

  assert.equal(result.found.website?.domain, "biogassnorge.no");
  assert.equal(result.found.people.length, 1);
  assert.equal(result.found.people[0]?.email, "kari@biogassnorge.no");
  assert.equal(result.found.people[0]?.role, "Daglig leder");
  assert.ok(!result.unknown.some((u) => /lists no website/.test(u)));
});
