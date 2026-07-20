"use client";

import Link from "next/link";
import type { GlobalContactRecord } from "@/lib/contact-utils";
import { PipelineDealBadge } from "@/components/ui/pipeline-deal-badge";
import { getContactDisplayName } from "@/types/contact";
import {
  CompanyLink,
  ContactLink,
  EmailActionMenu,
  PhoneActionMenu,
} from "@/components/relationship/relationship-links";

const columnWidths = [160, 120, 120, 136, 176, 88, 0] as const;

const tableHeaders = [
  "Display Name",
  "Job Title",
  "Role",
  "Company",
  "Contact Channels",
  "Status",
  "Linked Deals",
] as const;

type ContactTableProps = {
  records: GlobalContactRecord[];
  selectedKey?: string;
  onSelect: (record: GlobalContactRecord) => void;
  onPipelineSelect?: (pipelineId: string) => void;
};

function recordKey(record: GlobalContactRecord) {
  return `${record.companyId}-${record.contact.ContactID}`;
}

export function ContactTable({
  records,
  selectedKey,
  onSelect,
  onPipelineSelect,
}: ContactTableProps) {
  return (
    <section className="border border-carbon-blue/15 bg-white">
      <header className="border-b border-carbon-blue/10 px-3 py-2">
        <h2 className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45">
          Global Contact Directory
        </h2>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-left">
          <colgroup>
            {columnWidths.map((width, index) => (
              <col
                key={`colgroup-contact-${index}`}
                style={width > 0 ? { width } : undefined}
              />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b border-carbon-blue/15 bg-carbon-blue/[0.03]">
              {tableHeaders.map((header) => (
                <th
                  key={header}
                  className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.map((record) => {
              const key = recordKey(record);
              const selected = selectedKey === key;
              const displayName = getContactDisplayName(record.contact);

              return (
                <tr
                  key={key}
                  onClick={() => onSelect(record)}
                  className={`cursor-pointer border-b border-carbon-blue/10 last:border-b-0 ${
                    selected
                      ? "bg-upcycle-orange/[0.06] ring-1 ring-inset ring-upcycle-orange/30"
                      : "hover:bg-flame/10"
                  }`}
                >
                  <td className="px-2 py-1">
                    <ContactLink
                      contactId={record.contact.ContactID}
                      companyId={record.companyId}
                      className="text-xs font-semibold text-carbon-blue"
                    >
                      {displayName}
                    </ContactLink>
                    <p className="mt-0.5 font-mono text-[9px] text-carbon-blue/45">
                      {record.contact.ContactID}
                    </p>
                  </td>
                  <td className="px-2 py-1 text-xs text-carbon-blue/70">
                    {record.contact.JobTitle || "—"}
                  </td>
                  <td className="px-2 py-1">
                    <span className="inline-flex items-center border border-carbon-blue/20 bg-carbon-blue/[0.04] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/70">
                      {record.contact.Role}
                    </span>
                  </td>
                  <td className="px-2 py-1">
                    <CompanyLink companyId={record.companyId} className="text-xs font-semibold text-carbon-blue">
                      {record.companyName}
                    </CompanyLink>
                    <p className="mt-0.5 font-mono text-[9px] text-carbon-blue/45">
                      {record.companyId}
                    </p>
                  </td>
                  <td className="px-2 py-1" onClick={(event) => event.stopPropagation()}>
                    <EmailActionMenu email={record.contact.Email} className="block truncate font-mono text-[10px] text-carbon-blue/65" />
                    <PhoneActionMenu phone={record.contact.Phone} className="mt-0.5 block truncate font-mono text-[10px] text-carbon-blue/65" />
                    {record.contact.Mobile ? (
                      <PhoneActionMenu phone={record.contact.Mobile} className="mt-0.5 block truncate font-mono text-[10px] text-carbon-blue/50" />
                    ) : null}
                  </td>
                  <td className="px-2 py-1">
                    <span className="text-[10px] font-semibold text-carbon-blue/70">
                      {record.contact.Status}
                    </span>
                    <p className="mt-0.5 text-[9px] text-carbon-blue/45">
                      {record.contact.RelationshipLevel}
                    </p>
                  </td>
                  <td className="px-2 py-1">
                    <div className="flex flex-wrap gap-1">
                      {record.linkedPipelineIds.length > 0 ? (
                        record.linkedPipelineIds.map((pipelineId) =>
                          onPipelineSelect ? (
                            <PipelineDealBadge
                              key={`${key}-${pipelineId}`}
                              pipelineId={pipelineId}
                              onSelect={onPipelineSelect}
                            />
                          ) : (
                            <span
                              key={`${key}-${pipelineId}`}
                              className="border border-upcycle-orange/30 bg-upcycle-orange/10 px-2 py-0.5 font-mono text-[9px] text-upcycle-orange"
                            >
                              {pipelineId}
                            </span>
                          ),
                        )
                      ) : (
                        <span className="text-[10px] text-carbon-blue/40">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export { recordKey as globalContactRecordKey };
