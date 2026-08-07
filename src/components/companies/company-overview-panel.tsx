import type { Company } from "@/lib/companies-data";
import type { Activity } from "@/types/activity";
import type { PipelineRow } from "@/types/pipeline";
import type { CreateContactInput, EditableContactField } from "@/types/contact";
import { formatCompanyLocation } from "@/types/company";
import { formatCompanyWebsite } from "@/lib/company-domain";
import { CompanyContactsSection } from "@/components/companies/company-contacts-section";
import { PipelineDealBadge } from "@/components/ui/pipeline-deal-badge";

export function CompanyOverviewPanel({
  company,
  linkedPipelines,
  activities,
  onPipelineSelect,
  onContactFieldCommit,
  onCreateContact,
}: {
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
}) {
  const fields = [
    { label: "Company ID", value: company.CompanyID },
    { label: "Company Name", value: company.Title },
    { label: "Industry", value: company.Industry },
    { label: "Status", value: company.Status },
    { label: "Account Owner", value: company.AccountOwner?.Title ?? "—" },
    { label: "Website", value: formatCompanyWebsite(company.Domain) || "—" },
    { label: "Phone", value: company.Phone || "—" },
    { label: "Location", value: formatCompanyLocation(company) },
    {
      label: "Parent Company",
      value: company.ParentCompany?.Title ?? "—",
    },
    { label: "Active Deals", value: String(company.pipelineIds.length) },
  ];

  return (
    <div className="flex flex-col gap-3">
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

      <section className="border border-carbon-blue/10">
        <header className="border-b border-carbon-blue/10 px-3 py-1.5">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            Linked Plant Deals
          </h3>
        </header>
        <div className="grid grid-cols-2 gap-px bg-carbon-blue/10">
          {linkedPipelines.map((pipeline) => (
            <div key={pipeline.id} className="bg-white px-3 py-2">
              <PipelineDealBadge
                pipelineId={pipeline.id}
                onSelect={onPipelineSelect}
              />
              <p className="mt-0.5 text-xs font-semibold text-carbon-blue">
                {pipeline.reactorDesignCapacity.toLocaleString("en-US")} kg/h
              </p>
              <p className="mt-0.5 truncate text-[10px] text-upcycle-orange">
                {pipeline.currentMilestone}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="border border-carbon-blue/10">
        <header className="border-b border-carbon-blue/10 px-3 py-1.5">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            Active Feedstock Tracks
          </h3>
        </header>
        <ul className="divide-y divide-carbon-blue/10">
          {linkedPipelines.map((pipeline) => (
            <li
              key={pipeline.id}
              className="flex items-center justify-between px-3 py-2"
            >
              <span className="text-xs text-carbon-blue">{pipeline.targetFeedstock}</span>
              <PipelineDealBadge
                pipelineId={pipeline.id}
                onSelect={onPipelineSelect}
              />
            </li>
          ))}
        </ul>
      </section>

      <CompanyContactsSection
        contacts={company.contacts}
        activities={activities}
        onFieldCommit={onContactFieldCommit}
        onCreateContact={onCreateContact}
      />
    </div>
  );
}
