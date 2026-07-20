import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { SmartDocsIntelligenceItem } from "@/lib/smartdocs-intelligence-data";
import { buildDocumentImpactLines } from "@/lib/impact-context";
import { ImpactContext } from "@/components/ui/impact-context";
import { DocumentHealthBadge } from "@/components/smartdocs/document-intelligence-display";

export function SmartDocsIntelligenceRow({ item }: { item: SmartDocsIntelligenceItem }) {
  const impact = buildDocumentImpactLines({
    companyCount: 0,
    opportunityCount: item.document.pipelineId ? 1 : 0,
    referenceCount: item.referenceCount,
    businessImpactLevel: item.insights.businessImpactLevel,
    riskCount: item.risks.length,
  });

  return (
    <Link
      href={item.href}
      className="group block border-b border-carbon-blue/6 px-6 py-4 last:border-b-0 transition-colors hover:bg-carbon-blue/[0.02]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-carbon-blue group-hover:text-upcycle-orange">
              {item.document.displayName}
            </p>
            <DocumentHealthBadge status={item.healthStatus} />
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-carbon-blue/55">
            {item.nextBestAction.action}
          </p>
          <ImpactContext items={impact} />
        </div>
      </div>
    </Link>
  );
}

export function MissingCriticalDocumentRow({
  item,
}: {
  item: {
    id: string;
    entityName: string;
    label: string;
    detail: string;
    href: string;
  };
}) {
  return (
    <Link
      href={item.href}
      className="group block border-b border-carbon-blue/6 px-6 py-4 last:border-b-0 hover:bg-carbon-blue/[0.02]"
    >
      <p className="text-sm font-semibold text-carbon-blue group-hover:text-upcycle-orange">
        {item.entityName}
      </p>
      <p className="mt-1 text-[11px] font-medium text-red-600">{item.label}</p>
      <ImpactContext items={[item.detail, "Required documentation gap on active deal or account"]} />
    </Link>
  );
}
