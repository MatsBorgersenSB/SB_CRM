"use client";

import type { Company360Header } from "@/lib/company-360-data";
import type { CompanyHeroIdentityView } from "@/lib/company-identity";
import { hasCompanyOwner } from "@/lib/company-owner";
import type { Company } from "@/types/company";
import { CompanyTypeBadges } from "@/components/companies/company-type-badges";
import { PhoneActionMenu } from "@/components/relationship/relationship-links";
import { decodePhoneForDisplay } from "@/lib/company-identity";
import {
  ActionableField,
  HealthStatusIcon,
  SmartCRMIcon,
} from "@/components/ui/smartcrm-icon";

/**
 * Full-width company header — name + account owner first (accountability),
 * then type/status, reachability on the right.
 */
export function CompanyWorkspaceHeader({
  header,
  identity,
  company,
}: {
  header: Company360Header;
  identity: CompanyHeroIdentityView;
  company: Company;
}) {
  const websiteHref = identity.website
    ? identity.website.startsWith("http")
      ? identity.website
      : `https://${identity.website}`
    : null;

  const ownerAssigned = hasCompanyOwner(company);

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0 flex-1">
        <h1 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight text-carbon-blue xl:text-[1.85rem]">
          <SmartCRMIcon name="company" size="lg" label="Company" />
          <span className="truncate">{header.companyName}</span>
        </h1>

        {/* Account Owner — primary accountability signal under the name */}
        <div
          className={`mt-3 inline-flex max-w-full flex-col border px-3 py-2 ${
            ownerAssigned
              ? "border-carbon-blue/12 bg-carbon-blue/[0.03]"
              : "border-thermal-red/25 bg-thermal-red/[0.04]"
          }`}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-carbon-blue/40">
            Account Owner
          </p>
          {ownerAssigned ? (
            <p className="mt-0.5 text-[15px] font-semibold text-carbon-blue">
              {header.accountOwner}
            </p>
          ) : (
            <p className="mt-0.5 text-[13px] font-medium text-thermal-red">
              Incomplete — assign an account owner
            </p>
          )}
        </div>

        <div className="mt-4">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-carbon-blue/40">
            Company Type
          </p>
          <CompanyTypeBadges types={header.companyTypes} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 border border-carbon-blue/10 bg-carbon-blue/[0.03] px-2.5 py-1 text-[12px] font-medium text-carbon-blue">
            <HealthStatusIcon status={header.healthStatus} />
            {header.healthStatus}
          </span>
          <span className="border border-carbon-blue/10 px-2.5 py-1 text-[12px] font-medium text-carbon-blue/70">
            {header.status}
          </span>
          <span className="border border-carbon-blue/10 px-2.5 py-1 text-[12px] font-medium text-carbon-blue/55">
            {header.industry}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-2 text-[13px] text-carbon-blue/65 lg:min-w-[240px] lg:items-end lg:text-right xl:min-w-[280px]">
        {header.location !== "—" ? (
          <ActionableField icon="location" className="lg:justify-end">
            {header.location}
          </ActionableField>
        ) : null}
        {identity.website ? (
          <ActionableField icon="website" className="lg:justify-end">
            {websiteHref ? (
              <a
                href={websiteHref}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-upcycle-orange"
              >
                {identity.website.replace(/^https?:\/\//, "")}
              </a>
            ) : (
              identity.website
            )}
          </ActionableField>
        ) : null}
        {identity.mainPhone ? (
          <ActionableField icon="phone" className="lg:justify-end">
            <PhoneActionMenu phone={decodePhoneForDisplay(identity.mainPhone)} />
          </ActionableField>
        ) : null}
      </div>
    </div>
  );
}
