import { CompanyClassificationReport } from "@/components/companies/company-classification-report";
import { AnalyticsInsightCards } from "@/components/analytics/analytics-insight-cards";
import { FeedstockVelocityLedger } from "@/components/analytics/feedstock-velocity-ledger";
import { SmartDocsComplianceLedger } from "@/components/analytics/smartdocs-compliance-ledger";
import { WorkspaceChrome } from "@/components/layout/workspace-chrome";
import { buildCompanyClassificationReport } from "@/lib/company-classification";
import { readAnalytics, readCompanies, readPipelines } from "@/lib/pipeline-db";

export default async function AnalyticsPage() {
  const [analytics, pipelines, companies] = await Promise.all([
    readAnalytics(),
    readPipelines(),
    readCompanies(),
  ]);

  const smartDocsTransactions = pipelines.filter(
    (pipeline) => pipeline.FileLeafRef && pipeline.ClientLookup && pipeline.DocType,
  );

  const classification = buildCompanyClassificationReport(companies);

  return (
    <WorkspaceChrome>
        <header className="flex h-11 shrink-0 items-center justify-between border-b border-carbon-blue/15 bg-white px-4">
          <h1 className="text-sm font-semibold text-carbon-blue">Analytics</h1>
          <span className="border border-upcycle-orange/30 bg-upcycle-orange/10 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-upcycle-orange">
            {smartDocsTransactions.length}
          </span>
        </header>

        <main className="flex-1 overflow-auto p-3">
          <div className="flex flex-col gap-3">
            <AnalyticsInsightCards insights={analytics.insights} />

            <section className="dashboard-card p-4">
              <h2 className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-carbon-blue/45">
                Company Classification
              </h2>
              <CompanyClassificationReport report={classification} />
            </section>

            <div className="grid grid-cols-2 gap-3">
              <FeedstockVelocityLedger streams={analytics.feedstockStreams} />
              <SmartDocsComplianceLedger transactions={smartDocsTransactions} />
            </div>
          </div>
        </main>
    </WorkspaceChrome>
  );
}
