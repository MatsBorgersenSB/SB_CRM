"use client";

import type { CompanyRelationshipSummary } from "@/lib/relationship-intelligence";
import {
  HEALTH_STATUS_STYLES,
  RelationshipHealthBadge,
  RelationshipTrendBadge,
} from "@/components/relationship/relationship-health-display";
import { CompanyLink } from "@/components/relationship/relationship-links";
import { formatCompanyLocation } from "@/types/company";

const columnWidths = [0, 120, 100, 72, 88, 72, 64, 56] as const;

const tableHeaders = [
  "Company",
  "Industry",
  "Location",
  "Health",
  "Trend",
  "Last contact",
  "Actions",
  "Deals",
] as const;

export function CompanyTable({
  summaries,
  onSelect,
}: {
  summaries: CompanyRelationshipSummary[];
  onSelect: (companyId: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed border-collapse text-left">
        <colgroup>
          {columnWidths.map((width, index) => (
            <col
              key={`colgroup-company-${index}`}
              style={width > 0 ? { width } : undefined}
            />
          ))}
        </colgroup>
        <thead>
          <tr className="border-b border-carbon-blue/8 bg-carbon-blue/[0.03]">
            {tableHeaders.map((header) => (
              <th
                key={header}
                className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {summaries.map((summary) => (
            <tr
              key={summary.company.CompanyID}
              onClick={() => onSelect(summary.company.CompanyID)}
              className="cursor-pointer border-b border-carbon-blue/6 last:border-b-0 hover:bg-carbon-blue/[0.02]"
            >
              <td className="px-3 py-2.5" onClick={(event) => event.stopPropagation()}>
                <CompanyLink companyId={summary.company.CompanyID} className="text-xs font-semibold text-carbon-blue">
                  {summary.company.Title}
                </CompanyLink>
                <p className="mt-0.5 font-mono text-[9px] text-carbon-blue/35">
                  {summary.company.CompanyID}
                </p>
              </td>
              <td className="px-3 py-2.5 text-[11px] text-carbon-blue/70">
                {summary.company.Industry}
              </td>
              <td className="px-3 py-2.5 text-[11px] text-carbon-blue/60">
                {formatCompanyLocation(summary.company)}
              </td>
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`inline-flex min-w-8 items-center justify-center border px-1 py-0.5 text-[10px] font-bold tabular-nums ${HEALTH_STATUS_STYLES[summary.healthStatus]}`}
                  >
                    {summary.healthScore}
                  </span>
                  <RelationshipHealthBadge status={summary.healthStatus} />
                </div>
              </td>
              <td className="px-3 py-2.5">
                <RelationshipTrendBadge trend={summary.trend} />
              </td>
              <td className="px-3 py-2.5 text-[11px] text-carbon-blue/65">
                {summary.lastContactLabel}
              </td>
              <td
                className={`px-3 py-2.5 text-[11px] font-medium tabular-nums ${
                  summary.openActions > 0 ? "text-upcycle-orange" : "text-carbon-blue/65"
                }`}
              >
                {summary.openActions}
              </td>
              <td className="px-3 py-2.5 text-[11px] font-medium tabular-nums text-carbon-blue/65">
                {summary.activeDeals}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
