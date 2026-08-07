"use client";

import { useMemo, useState } from "react";
import type { Company } from "@/lib/companies-data";
import type { Activity } from "@/types/activity";
import type { PipelineRow } from "@/types/pipeline";
import { formatReactorCapacity } from "@/types/pipeline";
import type { CreateContactInput, EditableContactField } from "@/types/contact";
import { ActivityTimeline } from "@/components/activities/activity-timeline";
import { CompanyContactsSection } from "@/components/companies/company-contacts-section";
import { EntityTabBar } from "@/components/ui/entity-tab-bar";
import { PipelineDealBadge } from "@/components/ui/pipeline-deal-badge";
import { formatCompanyLocation } from "@/types/company";
import { formatCompanyWebsite } from "@/lib/company-domain";
import { getActivitiesForCompany } from "@/lib/activity-utils";

type CompanyDetailPanelProps = {
  company: Company;
  linkedPipelines: PipelineRow[];
  activities: Activity[];
  onPipelineSelect: (pipelineId: string) => void;
  onContactFieldCommit: (
    contactId: string,
    field: EditableContactField,
    value: string,
  ) => Promise<void>;
  onCreateContact: (input: CreateContactInput) => Promise<void>;
};

export function CompanyDetailPanel({
  company,
  linkedPipelines,
  activities,
  onPipelineSelect,
  onContactFieldCommit,
  onCreateContact,
}: CompanyDetailPanelProps) {
  const [tab, setTab] = useState("overview");
  const companyActivities = useMemo(
    () => getActivitiesForCompany(activities, company),
    [activities, company],
  );

  const fields = [
    { label: "Company ID", value: company.CompanyID },
    { label: "Company Name", value: company.Title },
    { label: "Industry", value: company.Industry },
    { label: "Status", value: company.Status },
    { label: "Account Owner", value: company.AccountOwner?.Title ?? "—" },
    { label: "Website", value: formatCompanyWebsite(company.Domain) || "—" },
    { label: "Phone", value: company.Phone || "—" },
    { label: "Location", value: formatCompanyLocation(company) },
    { label: "Parent Company", value: company.ParentCompany?.Title ?? "—" },
    { label: "Active Deals", value: String(company.pipelineIds.length) },
  ];

  return (
    <div className="flex flex-col gap-3">
      <EntityTabBar
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "contacts", label: "Contacts" },
          { id: "deals", label: "Deals" },
          { id: "activities", label: "Activities" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "overview" ? (
        <dl className="grid gap-0 border border-carbon-blue/10">
          {fields.map((field) => (
            <div
              key={field.label}
              className="grid grid-cols-[108px_1fr] border-b border-carbon-blue/10 last:border-b-0"
            >
              <dt className="border-r border-carbon-blue/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                {field.label}
              </dt>
              <dd className="px-3 py-2 text-xs text-carbon-blue">{field.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {tab === "contacts" ? (
        <CompanyContactsSection
          contacts={company.contacts}
          activities={activities}
          onFieldCommit={onContactFieldCommit}
          onCreateContact={onCreateContact}
        />
      ) : null}

      {tab === "deals" ? (
        <section className="border border-carbon-blue/10">
          <div className="grid grid-cols-1 gap-px bg-carbon-blue/10">
            {linkedPipelines.map((pipeline) => (
              <div key={pipeline.id} className="bg-white px-3 py-2">
                <PipelineDealBadge
                  pipelineId={pipeline.id}
                  onSelect={onPipelineSelect}
                />
                <p className="mt-1 text-xs font-semibold text-carbon-blue">
                  {pipeline.assetName}
                </p>
                <p className="mt-0.5 text-[10px] text-carbon-blue/55">
                  {pipeline.targetFeedstock} · {formatReactorCapacity(pipeline.reactorDesignCapacity)}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {tab === "activities" ? (
        <ActivityTimeline
          activities={companyActivities}
          emptyMessage="No activity history for this company yet."
        />
      ) : null}
    </div>
  );
}
