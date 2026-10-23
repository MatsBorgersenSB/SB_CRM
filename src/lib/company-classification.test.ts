import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getCompanyRelationshipPosture,
  isCompanyUnclassified,
  isOpportunityEligibleCompany,
} from "@/lib/company-classification";
import type { CompanyType } from "@/types/company-type";

const co = (...types: CompanyType[]) =>
  ({ CompanyTypes: types, companyType: undefined, Status: undefined }) as unknown as Parameters<
    typeof isOpportunityEligibleCompany
  >[0];

describe("relationship posture gating (north star hard rules)", () => {
  it("allows opportunities only for sell-to roles", () => {
    for (const t of ["Customer", "Prospect", "Offtaker"] as CompanyType[]) {
      assert.equal(isOpportunityEligibleCompany(co(t)), true, t);
    }
  });

  it("never allows opportunities for buy-from, watch, fund, internal or partner-alone", () => {
    const blocked: CompanyType[] = [
      "Supplier / Vendor",
      "Consultant",
      "Service Provider",
      "Competitor",
      "Investor",
      "Internal Company",
      "Partner",
    ];
    for (const t of blocked) {
      assert.equal(isOpportunityEligibleCompany(co(t)), false, t);
    }
  });

  it("multi-type with a sell-to role enables commercial actions", () => {
    assert.equal(isOpportunityEligibleCompany(co("Partner", "Prospect")), true);
  });

  it("unknown stays unclassified and is not eligible", () => {
    const empty = co();
    assert.equal(isCompanyUnclassified(empty), true);
    assert.equal(getCompanyRelationshipPosture(empty), "unclassified");
    assert.equal(isOpportunityEligibleCompany(empty), false);
  });
});
