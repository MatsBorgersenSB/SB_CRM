"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Building2, MapPin, User } from "lucide-react";
import {
  Company360HeroIdentity,
  CompanyHeroAddress,
  CompanyHeroPrimaryFields,
} from "@/components/company-360/company-360-hero-identity";
import { buildCompanyHeroIdentity } from "@/lib/company-identity";
import type { CompanyHeroQuickEdit } from "@/lib/company-identity";
import type { Company360Snapshot } from "@/lib/company-360-data";
import type { Company } from "@/types/company";
import {
  RelationshipHealthBadge,
  RelationshipTrendBadge,
  HEALTH_STATUS_STYLES,
} from "@/components/relationship/relationship-health-display";

type Company360IdentityHeaderProps = {
  snapshot: Company360Snapshot;
  companies: Company[];
  onCompanyUpdate?: (patch: CompanyHeroQuickEdit) => Promise<void>;
  canDeleteCompany?: boolean;
  companyDeletable?: boolean;
  onCompanyDelete?: () => Promise<void>;
};

export function Company360IdentityHeader({
  snapshot,
  companies,
  onCompanyUpdate,
  canDeleteCompany = false,
  companyDeletable = false,
  onCompanyDelete,
}: Company360IdentityHeaderProps) {
  const { header, company } = snapshot;
  const identity = buildCompanyHeroIdentity(company);
  const [heroEditing, setHeroEditing] = useState(false);

  return (
    <section className="dashboard-card overflow-hidden">
      <div className="border-b border-carbon-blue/8 px-6 py-4">
        <Link
          href="/companies"
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-carbon-blue/45 transition-colors hover:text-upcycle-orange"
        >
          <ArrowLeft className="size-3.5" strokeWidth={2} />
          Companies
        </Link>
      </div>

      <div className="px-6 py-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex size-9 items-center justify-center border border-carbon-blue/10 bg-carbon-blue/[0.03]">
              <Building2 className="size-4 text-carbon-blue/50" strokeWidth={1.75} />
            </span>
            <RelationshipHealthBadge status={header.healthStatus} />
            <RelationshipTrendBadge trend={header.trend} />
          </div>
          <span
            className={`flex size-11 shrink-0 items-center justify-center border text-base font-bold tabular-nums ${HEALTH_STATUS_STYLES[header.healthStatus]}`}
            aria-label={`Health score ${header.healthScore}`}
          >
            {header.healthScore}
          </span>
        </div>

        <div className="mt-4">
          {onCompanyUpdate ? (
            <Company360HeroIdentity
              company={company}
              companies={companies}
              onSave={onCompanyUpdate}
              canDelete={canDeleteCompany}
              companyDeletable={companyDeletable}
              onDelete={onCompanyDelete}
              showInlineFields={false}
              onEditingChange={setHeroEditing}
            />
          ) : (
            <h1 className="text-2xl font-semibold tracking-tight text-carbon-blue sm:text-3xl">
              {header.companyName}
            </h1>
          )}

          {(header.location !== "—" || header.accountOwner) ? (
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-carbon-blue/50">
              {header.location !== "—" ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3 shrink-0" />
                  {header.location}
                </span>
              ) : null}
              {header.accountOwner ? (
                <span className="inline-flex items-center gap-1">
                  <User className="size-3 shrink-0" />
                  {header.accountOwner}
                </span>
              ) : null}
            </p>
          ) : null}

          {!heroEditing ? (
            <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <CompanyHeroPrimaryFields identity={identity} className="" />
              <div className="shrink-0 sm:max-w-[220px] sm:pt-0.5">
                <CompanyHeroAddress identity={identity} />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
