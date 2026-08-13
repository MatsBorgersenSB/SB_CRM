"use client";

import type { Company360Header } from "@/lib/company-360-data";
import type { CompanyHeroIdentityView } from "@/lib/company-identity";
import { hasCompanyOwner } from "@/lib/company-owner";
import type { Company } from "@/types/company";
import { PhoneActionMenu } from "@/components/relationship/relationship-links";
import { decodePhoneForDisplay } from "@/lib/company-identity";
import {
  ActionableField,
  HealthStatusIcon,
  SmartCRMIcon,
} from "@/components/ui/smartcrm-icon";
import type { ReactNode } from "react";

/**
 * One prose status story — not a pill cluster of type / health / stage / industry.
 */
function buildRelationshipStatusStory(header: Company360Header): string {
  const parts: string[] = [];

  if (header.companyTypesLabel?.trim()) {
    parts.push(header.companyTypesLabel.trim());
  }

  parts.push(`${header.healthStatus} relationship`);

  if (header.status) {
    parts.push(String(header.status));
  }

  if (header.industry && String(header.industry).trim() && header.industry !== "—") {
    parts.push(String(header.industry));
  }

  return parts.join(" · ");
}

function nextActionLabel(header: Company360Header): string {
  const action = header.recommendedAction;
  if ("action" in action && action.action) return action.action;
  return action.title ?? "Review this account";
}

/**
 * Company 360 identity strip — name, status story, next action, secondary facts.
 * Michelin: few ingredients. Apple: clear in 3 seconds.
 */
export function CompanyWorkspaceHeader({
  header,
  identity,
  company,
  trailing,
}: {
  header: Company360Header;
  identity: CompanyHeroIdentityView;
  company: Company;
  /** Secondary overflow (account tools) — not equal primary buttons */
  trailing?: ReactNode;
}) {
  const websiteHref = identity.website
    ? identity.website.startsWith("http")
      ? identity.website
      : `https://${identity.website}`
    : null;

  const ownerAssigned = hasCompanyOwner(company);
  const statusStory = buildRelationshipStatusStory(header);
  const nextLabel = nextActionLabel(header);
  const nextReason = header.recommendedAction.reason;

  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-start justify-between gap-3">
        <h1 className="flex min-w-0 items-center gap-2.5 text-2xl font-semibold tracking-tight text-carbon-blue xl:text-[1.85rem]">
          <SmartCRMIcon name="company" size="lg" label="Company" />
          <span className="truncate">{header.companyName}</span>
        </h1>
        {trailing ? <div className="shrink-0 pt-1">{trailing}</div> : null}
      </div>

      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-snug text-carbon-blue/70">
        <HealthStatusIcon status={header.healthStatus} size="sm" />
        <span>{statusStory}</span>
      </p>

      <div className="mt-3 border-l-2 border-upcycle-orange/50 pl-3">
        <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-carbon-blue/40">
          Next
        </p>
        <p className="mt-0.5 text-[14px] font-semibold text-carbon-blue">{nextLabel}</p>
        {nextReason ? (
          <p className="mt-0.5 text-[12px] leading-relaxed text-carbon-blue/55">{nextReason}</p>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-carbon-blue/60">
        <span
          className={
            ownerAssigned
              ? "text-carbon-blue/60"
              : "font-medium text-thermal-red"
          }
        >
          {ownerAssigned
            ? `Owner ${header.accountOwner}`
            : "Owner incomplete — assign an account owner"}
        </span>

        {header.location !== "—" ? (
          <ActionableField icon="location" className="text-[12px] text-carbon-blue/60">
            {header.location}
          </ActionableField>
        ) : null}

        {identity.website ? (
          <ActionableField icon="website" className="text-[12px] text-carbon-blue/60">
            {websiteHref ? (
              <a
                href={websiteHref}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-upcycle-orange"
              >
                {identity.website.replace(/^https?:\/\//, "")}
              </a>
            ) : (
              identity.website
            )}
          </ActionableField>
        ) : null}

        {identity.mainPhone ? (
          <ActionableField icon="phone" className="text-[12px] text-carbon-blue/60">
            <PhoneActionMenu phone={decodePhoneForDisplay(identity.mainPhone)} />
          </ActionableField>
        ) : null}
      </div>
    </div>
  );
}
