import Link from "next/link";
import { Workflow } from "lucide-react";
import type { Document360Snapshot } from "@/lib/document-360-data";
import { formatDealValue } from "@/types/pipeline";
import { company360Href } from "@/types/company-360";
import { MISSING_DOC_ICONS } from "@/types/smartdoc";

export function Document360OpportunitiesTab({ snapshot }: { snapshot: Document360Snapshot }) {
  const { pipeline, missingReports, companies } = snapshot;

  const dealReports = missingReports.filter((r) => r.entityKind === "deal");

  return (
    <div className="space-y-4">
      <section className="dashboard-card">
        <header className="flex items-center gap-2 border-b border-carbon-blue/8 px-5 py-3">
          <Workflow className="size-4 text-carbon-blue/40" />
          <h2 className="text-sm font-semibold text-carbon-blue">Linked opportunity</h2>
        </header>
        {pipeline ? (
          <div className="px-5 py-4">
            <p className="text-sm font-semibold text-carbon-blue">{pipeline.assetName}</p>
            <p className="mt-1 text-[11px] text-carbon-blue/45">
              {pipeline.status} · {pipeline.id}
            </p>
            <p className="mt-1 text-[11px] font-medium text-carbon-blue/60">
              {formatDealValue(pipeline.currency, pipeline.salesValue)}
            </p>
            {companies[0] ? (
              <Link
                href={company360Href(companies[0].CompanyID, "opportunities")}
                className="mt-3 inline-block text-[11px] font-semibold text-upcycle-orange hover:underline"
              >
                View in Company 360 →
              </Link>
            ) : null}
          </div>
        ) : (
          <p className="px-5 py-6 text-xs text-carbon-blue/45">No linked deal.</p>
        )}
      </section>

      {dealReports.length > 0 ? (
        <section className="dashboard-card">
          <header className="border-b border-carbon-blue/8 px-5 py-3">
            <h2 className="text-sm font-semibold text-carbon-blue">Required documents</h2>
            <p className="mt-0.5 text-[11px] text-carbon-blue/45">
              Gaps for linked opportunities
            </p>
          </header>
          {dealReports.map((report) => (
            <div
              key={report.entityId}
              className="border-b border-carbon-blue/6 px-5 py-4 last:border-b-0"
            >
              <p className="text-sm font-semibold text-carbon-blue">{report.entityName}</p>
              <ul className="mt-2 space-y-1.5">
                {report.items.map((item) => (
                  <li key={item.spec.id} className="flex items-start gap-2 text-[11px]">
                    <span className="mt-0.5">{MISSING_DOC_ICONS[item.status]}</span>
                    <div>
                      <span className="font-medium text-carbon-blue/75">{item.spec.label}</span>
                      <span className="text-carbon-blue/40"> — {item.detail}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
