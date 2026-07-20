"use client";

import { useAuth } from "@/context/auth-context";
import type { Company } from "@/lib/companies-data";
import { canViewExecutiveKpis } from "@/lib/permissions";
import { formatCompanyLocation } from "@/types/company";

const columnWidths = [88, 0, 148, 120, 0] as const;

const tableHeaders = [
  "ID",
  "Company Name",
  "Facility/Industry Type",
  "Company Owner",
  "Location",
] as const;

function IndustryBadge({ industry }: { industry: Company["Industry"] }) {
  return (
    <span className="inline-flex items-center border border-carbon-blue/20 bg-carbon-blue/[0.04] px-1.5 py-0.5 text-[9px] font-semibold text-carbon-blue/75">
      {industry}
    </span>
  );
}

export function CompanyLedgerTable({
  companies,
  onSelect,
}: {
  companies: Company[];
  onSelect: (company: Company) => void;
}) {
  const { user } = useAuth();
  const readOnlyLedger = !canViewExecutiveKpis(user.role) && user.role !== "superuser";

  return (
    <section className="border border-carbon-blue/15 bg-white">
      <header className="flex items-center justify-between border-b border-carbon-blue/10 px-3 py-2">
        <h2 className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45">
          Enterprise Master Ledger
        </h2>
        {readOnlyLedger ? (
          <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/35">
            Read-Only
          </span>
        ) : null}
      </header>
      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-left">
          <colgroup>
            {columnWidths.map((width, index) => (
              <col
                key={`colgroup-enterprise-${index}`}
                style={width > 0 ? { width } : undefined}
              />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b border-carbon-blue/15 bg-carbon-blue/[0.03]">
              {tableHeaders.map((header, index) => (
                <th
                  key={`th-enterprise-${index}`}
                  className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {companies.map((company) => (
                <tr
                  key={company.CompanyID}
                  onClick={() => onSelect(company)}
                  className="cursor-pointer border-b border-carbon-blue/10 last:border-b-0 hover:bg-upcycle-orange/[0.04]"
                >
                  <td className="px-2 py-1 font-mono text-[11px] text-carbon-blue/55">
                    {company.CompanyID}
                  </td>
                  <td className="px-2 py-1 text-xs font-semibold text-carbon-blue">
                    {company.Title}
                  </td>
                  <td className="px-2 py-1">
                    <IndustryBadge industry={company.Industry} />
                  </td>
                  <td className="px-2 py-1 text-[11px] text-carbon-blue/80">
                    {company.AccountOwner?.Title ?? "—"}
                  </td>
                  <td className="px-2 py-1 text-[11px] text-carbon-blue/70">
                    {formatCompanyLocation(company)}
                  </td>
                </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
