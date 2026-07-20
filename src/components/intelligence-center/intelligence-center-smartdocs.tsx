import Link from "next/link";
import type { SmartDocsIntelligenceSnapshot } from "@/lib/smartdocs-intelligence-data";
import { IntelligenceCenterSection } from "@/components/intelligence-center/intelligence-center-section";
import {
  MissingCriticalDocumentRow,
  SmartDocsIntelligenceRow,
} from "@/components/smartdocs/smartdocs-intelligence-row";

export function IntelligenceCenterSmartDocs({
  smartDocs,
}: {
  smartDocs: SmartDocsIntelligenceSnapshot;
}) {
  const { overview } = smartDocs;

  return (
    <div className="space-y-6">
      <header className="dashboard-card px-6 py-5">
        <h2 className="text-sm font-semibold text-carbon-blue">Document intelligence</h2>
        <dl className="mt-5 grid grid-cols-3 gap-3">
          {[
            { label: "At risk", value: overview.atRiskCount, accent: true },
            { label: "Knowledge at risk", value: overview.knowledgeAtRiskCount, accent: true },
            { label: "Critical gaps", value: overview.criticalMissingCount, accent: true },
          ].map((kpi) => (
            <div key={kpi.label} className="border border-carbon-blue/8 px-4 py-3">
              <dt className="text-[9px] uppercase tracking-wider text-carbon-blue/40">{kpi.label}</dt>
              <dd
                className={`text-xl font-semibold tabular-nums ${
                  kpi.accent ? "text-upcycle-orange" : "text-carbon-blue"
                }`}
              >
                {kpi.value}
              </dd>
            </div>
          ))}
        </dl>
      </header>

      <div className="grid gap-6">
        <IntelligenceCenterSection
          title="Knowledge at risk"
          description="High-impact documents needing attention"
          count={smartDocs.knowledgeAtRisk.length}
          emptyMessage="No knowledge assets at risk."
          accent="risk"
        >
          {smartDocs.knowledgeAtRisk.map((item) => (
            <SmartDocsIntelligenceRow key={`kar-${item.document.id}`} item={item} />
          ))}
        </IntelligenceCenterSection>

        <IntelligenceCenterSection
          title="Document risks"
          description="Compliance and business risk signals"
          count={smartDocs.documentRisks.length}
          emptyMessage="No document risks detected."
          accent="risk"
        >
          {smartDocs.documentRisks.map((item) => (
            <SmartDocsIntelligenceRow key={item.document.id} item={item} />
          ))}
        </IntelligenceCenterSection>

        <IntelligenceCenterSection
          title="Missing critical documents"
          description="Required documentation gaps"
          count={smartDocs.missingCriticalDocuments.length}
          emptyMessage="No critical document gaps."
          accent="risk"
        >
          {smartDocs.missingCriticalDocuments.map((item) => (
            <MissingCriticalDocumentRow key={item.id} item={item} />
          ))}
        </IntelligenceCenterSection>
      </div>

      <p className="text-center text-[11px] text-carbon-blue/45">
        Open any row for Document 360 ·{" "}
        <Link href="/companies" className="font-semibold text-upcycle-orange hover:underline">
          Browse by company
        </Link>
      </p>
    </div>
  );
}
