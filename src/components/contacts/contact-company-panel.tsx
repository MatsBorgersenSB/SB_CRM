"use client";

import type { Company } from "@/types/company";
import { buildCompanyHeroIdentity } from "@/lib/company-identity";
import { buildCompanyRelationshipSummary } from "@/lib/relationship-intelligence";
import { CompanyLink } from "@/components/relationship/relationship-links";
import {
  ActionableField,
  HealthStatusIcon,
  SmartCRMIcon,
} from "@/components/ui/smartcrm-icon";
import type { Activity } from "@/types/activity";
import type { PipelineRow } from "@/types/pipeline";

/**
 * Company context panel on contact workspace.
 */
export function ContactCompanyPanel({
  company,
  activities,
  pipelines,
}: {
  company: Company;
  activities: Activity[];
  pipelines: PipelineRow[];
}) {
  const identity = buildCompanyHeroIdentity(company);
  const summary = buildCompanyRelationshipSummary(company, activities, pipelines);
  const websiteHref = identity.website
    ? identity.website.startsWith("http")
      ? identity.website
      : `https://${identity.website}`
    : null;

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0 flex-1">
        <h2 className="flex items-center gap-2.5 text-xl font-semibold tracking-tight text-carbon-blue">
          <SmartCRMIcon name="company" size="lg" label="Company" />
          <CompanyLink companyId={company.CompanyID} className="truncate hover:text-upcycle-orange">
            {company.Title}
          </CompanyLink>
        </h2>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 border border-carbon-blue/10 bg-carbon-blue/[0.03] px-2.5 py-1 text-[12px] font-medium text-carbon-blue">
            <HealthStatusIcon status={summary.healthStatus} />
            {summary.healthStatus}
          </span>
          <span className="border border-carbon-blue/10 px-2.5 py-1 text-[12px] font-medium text-carbon-blue/70">
            {company.Status}
          </span>
          <span className="text-[12px] text-carbon-blue/55">{company.Industry || "—"}</span>
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-2 text-[13px] text-carbon-blue/65 lg:min-w-[240px] lg:items-end lg:text-right">
        {identity.address ? (
          <ActionableField icon="location" className="lg:justify-end">
            {identity.address}
          </ActionableField>
        ) : null}
        {identity.website ? (
          <ActionableField icon="website" className="lg:justify-end">
            {websiteHref ? (
              <a href={websiteHref} target="_blank" rel="noopener noreferrer" className="hover:text-upcycle-orange">
                {identity.website.replace(/^https?:\/\//, "")}
              </a>
            ) : (
              identity.website
            )}
          </ActionableField>
        ) : null}
      </div>
    </div>
  );
}
