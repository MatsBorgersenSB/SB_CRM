import type { Document360Snapshot } from "@/lib/document-360-data";
import { Document360Actions } from "@/components/smartdocs/document-360-actions";
import {
  BusinessImpactBadge,
  DocumentHealthBadge,
} from "@/components/smartdocs/document-intelligence-display";
import { IntelligenceLead } from "@/components/ui/intelligence-lead";
import Link from "next/link";

/** Document as a first-class business object. */
export function DocumentAssetHero({ snapshot }: { snapshot: Document360Snapshot }) {
  const { header, intelligence, memberOf, memberOfHref } = snapshot;

  return (
    <IntelligenceLead
      eyebrow={`${header.docCategoryLabel} · ${header.docType}`}
      title={header.displayName}
      status={
        <>
          <DocumentHealthBadge status={header.healthStatus} />
          <BusinessImpactBadge level={header.businessImpactLevel} />
          <span className="border border-carbon-blue/15 bg-white px-2 py-0.5 font-mono text-[10px] font-semibold text-carbon-blue">
            v{header.currentVersion}
          </span>
        </>
      }
      summary={intelligence.insights.businessImpact}
      action={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-[11px] font-semibold text-upcycle-orange">{header.documentId}</p>
            {memberOf && memberOfHref ? (
              <p className="mt-1 text-[11px] text-carbon-blue/55">
                Member of{" "}
                <Link
                  href={memberOfHref}
                  className="font-mono font-semibold text-upcycle-orange hover:underline"
                >
                  {memberOf}
                </Link>
              </p>
            ) : null}
          </div>
          <Document360Actions snapshot={snapshot} layout="hero" />
        </div>
      }
    />
  );
}
