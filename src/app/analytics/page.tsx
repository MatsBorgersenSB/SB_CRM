import { AnalyticsReportingWorkspace } from "@/components/analytics/analytics-reporting-workspace";
import { AnalyticsInsightCards } from "@/components/analytics/analytics-insight-cards";
import { FeedstockVelocityLedger } from "@/components/analytics/feedstock-velocity-ledger";
import { SmartDocsComplianceLedger } from "@/components/analytics/smartdocs-compliance-ledger";
import { CompanyClassificationReport } from "@/components/companies/company-classification-report";
import { WorkspaceChrome } from "@/components/layout/workspace-chrome";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { buildCompanyClassificationReport } from "@/lib/company-classification";
import {
  readLiveAnalytics,
  readLiveCompanies,
  readLivePipelines,
} from "@/lib/prisma-data";

/**
 * FS-014 — Advanced Reporting & Analytics Workspace
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AnalyticsPage() {
  const [analytics, pipelines, companies] = await Promise.all([
    readLiveAnalytics(),
    readLivePipelines(),
    readLiveCompanies(),
  ]);

  const smartDocsTransactions = pipelines.filter(
    (pipeline) => pipeline.FileLeafRef && pipeline.ClientLookup && pipeline.DocType,
  );

  const classification = buildCompanyClassificationReport(companies);

  return (
    <WorkspaceChrome>
      <AnalyticsReportingWorkspace companies={companies} />

      <div className="shrink-0 border-t border-carbon-blue/10 bg-white px-3 py-3">
        <CollapsibleSection title="Operational ledgers (legacy)" tier="expert" defaultOpen={false}>
          <div className="mt-3 flex flex-col gap-3">
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
        </CollapsibleSection>
      </div>
    </WorkspaceChrome>
  );
}
