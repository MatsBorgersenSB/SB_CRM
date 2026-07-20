import type { Document360Snapshot } from "@/lib/document-360-data";
import { company360Href } from "@/types/company-360";
import { MISSING_DOC_ICONS } from "@/types/smartdoc";
import Link from "next/link";
import { DocumentHealthBreakdown } from "@/components/smartdocs/document-intelligence-display";
import { Document360HistoryTab } from "@/components/smartdocs/tabs/document-360-history-tab";
import { CollapsibleSection } from "@/components/ui/collapsible-section";

/** Deep intelligence — diagnostics collapsed by default. */
export function Document360IntelligenceTab({ snapshot }: { snapshot: Document360Snapshot }) {
  const { intelligence, missingReports, risks } = {
    intelligence: snapshot.intelligence,
    missingReports: snapshot.missingReports,
    risks: snapshot.intelligence.risks,
  };

  const topRisk = risks[0];

  return (
    <div className="flex flex-col gap-4">
      {topRisk ? (
        <section className="dashboard-card px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            Primary risk
          </p>
          <p className="mt-1 text-sm font-medium text-carbon-blue">{topRisk.label}</p>
          <p className="mt-1 text-[11px] text-carbon-blue/55">{topRisk.detail}</p>
        </section>
      ) : null}

      {risks.length > 1 ? (
        <CollapsibleSection
          title={`${risks.length - 1} more risk signal${risks.length === 2 ? "" : "s"}`}
          tier="expert"
        >
          <ul className="divide-y divide-carbon-blue/6">
            {risks.slice(1).map((risk) => (
              <li key={risk.id} className="py-3 first:pt-0 last:pb-0">
                <p className="text-sm font-medium text-carbon-blue">{risk.label}</p>
                <p className="mt-1 text-[11px] text-carbon-blue/55">{risk.detail}</p>
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      ) : null}

      <CollapsibleSection
        title="How is health scored?"
        description="Component breakdown and weighting"
        tier="expert"
      >
        <DocumentHealthBreakdown intelligence={intelligence} />
      </CollapsibleSection>

      {missingReports.length > 0 ? (
        <CollapsibleSection
          title="Missing documents"
          description={`${missingReports.reduce((sum, report) => sum + report.items.length, 0)} gaps across linked entities`}
        >
          {missingReports.map((report) => (
            <div
              key={report.entityId}
              className="border-b border-carbon-blue/6 py-4 last:border-b-0 last:pb-0"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-carbon-blue">{report.entityName}</p>
                {report.entityKind === "company" ? (
                  <Link
                    href={company360Href(report.entityId, "opportunities")}
                    className="text-[10px] font-semibold text-upcycle-orange hover:underline"
                  >
                    Company 360 →
                  </Link>
                ) : null}
              </div>
              <ul className="mt-3 space-y-2">
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
        </CollapsibleSection>
      ) : null}

      <CollapsibleSection title="Activity timeline" tier="expert">
        <Document360HistoryTab snapshot={snapshot} />
      </CollapsibleSection>
    </div>
  );
}
