"use client";

import Link from "next/link";
import type { Document360Snapshot } from "@/lib/document-360-data";
import { Document360Actions } from "@/components/smartdocs/document-360-actions";
import {
  BusinessImpactBadge,
  DocumentHealthBadge,
} from "@/components/smartdocs/document-intelligence-display";
import { SmartCRMIcon } from "@/components/ui/smartcrm-icon";

export function DocumentWorkspaceHeader({ snapshot }: { snapshot: Document360Snapshot }) {
  const { header, intelligence, memberOf, memberOfHref } = snapshot;

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0 flex-1">
        <h1 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight text-carbon-blue xl:text-[1.85rem]">
          <SmartCRMIcon name="document" size="lg" label="Document" />
          <span className="truncate">{header.displayName}</span>
        </h1>

        <p className="mt-2 text-sm text-carbon-blue/65">
          {header.docCategoryLabel} · {header.docType}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <DocumentHealthBadge status={header.healthStatus} />
          <BusinessImpactBadge level={header.businessImpactLevel} />
          <span className="border border-carbon-blue/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-carbon-blue">
            v{header.currentVersion}
          </span>
        </div>

        <p className="mt-3 text-sm text-carbon-blue/60">{intelligence.insights.businessImpact}</p>
      </div>

      <div className="flex shrink-0 flex-col gap-2 text-[13px] text-carbon-blue/65 lg:items-end lg:text-right">
        <p className="font-mono text-[11px] font-semibold text-upcycle-orange">{header.documentId}</p>
        {memberOf && memberOfHref ? (
          <p>
            Member of{" "}
            <Link href={memberOfHref} className="font-semibold text-upcycle-orange hover:underline">
              {memberOf}
            </Link>
          </p>
        ) : null}
        <Document360Actions snapshot={snapshot} layout="hero" />
      </div>
    </div>
  );
}
