"use client";

import Link from "next/link";
import { Building2 } from "lucide-react";
import type { M365HealthBlock } from "@/types/m365";
import { HealthRing } from "@/components/m365/health-ring";
import { SectorTagManager } from "@/components/companies/sector-tag-manager";
import {
  RelationshipHealthBadge,
  RelationshipTrendBadge,
} from "@/components/relationship/relationship-health-display";
import type { RelationshipHealthStatus, RelationshipTrend } from "@/lib/relationship-health-engine";

export function RelationshipHeader({
  companyName,
  companyId,
  relationshipRoleLabel,
  sectors,
  health,
  lastContactLabel,
  deepLink,
  hideHealthRing = false,
}: {
  companyName: string;
  /** When set, sector tags can be edited in place. */
  companyId?: string;
  /** Ecosystem role — Supplier, Prospect, Unclassified, etc. */
  relationshipRoleLabel?: string;
  sectors?: string[];
  health?: M365HealthBlock;
  lastContactLabel?: string;
  deepLink?: string;
  hideHealthRing?: boolean;
}) {
  return (
    <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex size-8 items-center justify-center border border-carbon-blue/10 bg-carbon-blue/[0.03]">
            <Building2 className="size-3.5 text-carbon-blue/50" strokeWidth={1.75} />
          </span>
          {health ? (
            <>
              <RelationshipHealthBadge status={health.status as RelationshipHealthStatus} />
              <RelationshipTrendBadge trend={health.trend as RelationshipTrend} />
            </>
          ) : null}
        </div>
        {deepLink ? (
          <Link href={deepLink} className="mt-2 block hover:text-upcycle-orange">
            <h2 className="text-xl font-semibold tracking-tight text-carbon-blue">{companyName}</h2>
          </Link>
        ) : (
          <h2 className="mt-1 text-base font-semibold tracking-tight text-carbon-blue">{companyName}</h2>
        )}
        {relationshipRoleLabel ? (
          <p className="mt-1 text-[11px] font-medium text-carbon-blue/55">{relationshipRoleLabel}</p>
        ) : null}
        {companyId ? (
          <div className="mt-1.5">
            <SectorTagManager
              companyId={companyId}
              sectors={sectors}
              density="outlook"
            />
          </div>
        ) : null}
        {lastContactLabel ? (
          <p className="mt-0.5 text-[11px] text-carbon-blue/45">
            Last contact · {lastContactLabel}
          </p>
        ) : null}
      </div>
      {health && !hideHealthRing ? <HealthRing health={health} size="md" /> : null}
    </header>
  );
}
