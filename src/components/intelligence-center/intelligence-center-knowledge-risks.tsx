import Link from "next/link";
import type { SmartDocsIntelligenceSnapshot } from "@/lib/smartdocs-intelligence-data";
import { buildDocumentImpactLines } from "@/lib/impact-context";
import { IntelligenceCenterSection } from "@/components/intelligence-center/intelligence-center-section";
import {
  MissingCriticalDocumentRow,
  SmartDocsIntelligenceRow,
} from "@/components/smartdocs/smartdocs-intelligence-row";
import { ImpactContext } from "@/components/ui/impact-context";

export function IntelligenceCenterKnowledgeRisks({
  smartDocs,
  compact,
}: {
  smartDocs: SmartDocsIntelligenceSnapshot;
  compact?: boolean;
}) {
  const { overview } = smartDocs;
  const featured = smartDocs.knowledgeAtRisk[0];

  if (compact) {
    return (
      <IntelligenceCenterSection
        title="Knowledge"
        description={`${overview.knowledgeAtRiskCount} assets at risk`}
        count={smartDocs.knowledgeAtRisk.length}
        href="/knowledge"
        emptyMessage="No knowledge assets at risk."
        accent="risk"
      >
        {smartDocs.knowledgeAtRisk.slice(0, 4).map((item) => (
          <SmartDocsIntelligenceRow key={`kar-${item.document.id}`} item={item} />
        ))}
        {smartDocs.missingCriticalDocuments.slice(0, 2).map((item) => (
          <MissingCriticalDocumentRow key={item.id} item={item} />
        ))}
      </IntelligenceCenterSection>
    );
  }

  const featuredImpact = featured
    ? buildDocumentImpactLines({
        companyCount: 0,
        opportunityCount: featured.document.pipelineId ? 1 : 0,
        referenceCount: featured.referenceCount,
        businessImpactLevel: featured.insights.businessImpactLevel,
        riskCount: featured.risks.length,
      })
    : [];

  return (
    <div className="space-y-8">
      <section className="dashboard-card px-6 py-7">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-carbon-blue/40">
          Knowledge assets
        </p>
        <h2 className="mt-3 text-xl font-semibold text-carbon-blue">
          {overview.knowledgeAtRiskCount > 0
            ? `${overview.knowledgeAtRiskCount} business asset${overview.knowledgeAtRiskCount === 1 ? "" : "s"} at risk`
            : "Knowledge layer is healthy"}
        </h2>
        <p className="mt-2 text-sm text-carbon-blue/55">
          Documents drive compliance, deals, and relationships — not file storage.
        </p>

        {featured ? (
          <div className="mt-6 border-l-2 border-upcycle-orange/40 pl-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-upcycle-orange/80">
              Highest priority asset
            </p>
            <Link
              href={featured.href}
              className="mt-2 block text-base font-semibold text-carbon-blue hover:text-upcycle-orange"
            >
              {featured.document.displayName}
            </Link>
            <p className="mt-1 text-[11px] text-carbon-blue/55">{featured.nextBestAction.action}</p>
            <ImpactContext items={featuredImpact} />
          </div>
        ) : null}
      </section>

      <div className="flex flex-col gap-8">
        {smartDocs.knowledgeAtRisk.length > 0 ? (
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
        ) : null}

        {smartDocs.documentRisks.length > 0 ? (
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
        ) : null}

        {smartDocs.missingCriticalDocuments.length > 0 ? (
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
        ) : null}
      </div>
    </div>
  );
}
