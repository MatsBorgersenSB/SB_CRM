"use client";

import type { Company360Header } from "@/lib/company-360-data";
import type { CompanyHeroIdentityView } from "@/lib/company-identity";
import { hasCompanyOwner } from "@/lib/company-owner";
import { canReassignCompanyOwner } from "@/lib/permissions";
import { CompanyOwnerSelect } from "@/components/companies/company-owner-select";
import type { Company, SharePointPerson } from "@/types/company";
import type { UserRole } from "@/types/auth";
import type { StandardBioUserRecord } from "@/types/user-access";
import { PhoneActionMenu } from "@/components/relationship/relationship-links";
import { decodePhoneForDisplay } from "@/lib/company-identity";
import {
  ActionableField,
  HealthStatusIcon,
  SmartCRMIcon,
} from "@/components/ui/smartcrm-icon";
import type { ReactNode } from "react";
import { SectorTagManager } from "@/components/companies/sector-tag-manager";
import { CompleteCommitmentCard } from "@/components/commitments/complete-commitment-card";
import type { PendingCommitmentView } from "@/lib/complete-commitment";
import type { Company360Verdict } from "@/lib/company-360-verdict";
import { formatRelativeTime } from "@/lib/relative-time";

/**
 * One prose status story — not a pill cluster of type / health / stage / industry.
 */
function buildRelationshipStatusStory(header: Company360Header): string {
  const parts: string[] = [];

  if (header.companyTypesLabel?.trim()) {
    parts.push(header.companyTypesLabel.trim());
  }

  // Claim a health only when there is something to score. Otherwise say so.
  parts.push(header.hasSignal ? `${header.healthStatus} relationship` : "No interactions recorded yet");

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
  companies = [],
  role,
  assignableUsers = [],
  trailing,
  pendingCommitment,
  onCompanyUpdated,
  onCommitmentChanged,
  onOwnerChange,
  ownerSaving = false,
  verdict,
}: {
  header: Company360Header;
  identity: CompanyHeroIdentityView;
  company: Company;
  companies?: Company[];
  role?: UserRole;
  assignableUsers?: StandardBioUserRecord[];
  /** Secondary overflow (account tools) — not equal primary buttons */
  trailing?: ReactNode;
  pendingCommitment?: PendingCommitmentView | null;
  onCompanyUpdated?: (company: Company) => void;
  onCommitmentChanged?: () => void;
  onOwnerChange?: (owner: SharePointPerson) => void;
  ownerSaving?: boolean;
  verdict?: Company360Verdict | null;
}) {
  const websiteHref = identity.website
    ? identity.website.startsWith("http")
      ? identity.website
      : `https://${identity.website}`
    : null;

  const ownerAssigned = hasCompanyOwner(company);
  const canEditOwner = Boolean(role && onOwnerChange && canReassignCompanyOwner(role));
  const statusStory = buildRelationshipStatusStory(header);
  const nextLabel = verdict?.nextAction ?? nextActionLabel(header);
  const nextReason = verdict?.nextReason ?? header.recommendedAction.reason;

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
        {header.hasSignal ? <HealthStatusIcon status={header.healthStatus} size="sm" /> : null}
        <span>{statusStory}</span>
      </p>

      <div className="mt-2">
        <SectorTagManager
          companyId={company.CompanyID}
          sectors={company.Sectors}
          onUpdated={onCompanyUpdated}
        />
      </div>

      {pendingCommitment ? (
        <CompleteCommitmentCard
          key={pendingCommitment.activityId}
          commitment={pendingCommitment}
          className="mt-3"
          onCompleted={onCommitmentChanged}
          onRescheduled={onCommitmentChanged}
        />
      ) : null}

      <div className="mt-3 max-w-[70ch] border-l-2 border-upcycle-orange/70 pl-3.5">
        <p className="text-xs font-semibold tracking-tight text-carbon-blue/70">
          Next recommended action
        </p>
        {nextLabel === "Collect competitor knowledge" ? (
          <a
            href="#add-finding"
            className="mt-0.5 inline-flex items-center gap-1.5 text-[15px] font-semibold text-upcycle-orange underline-offset-2 hover:underline"
          >
            {nextLabel}
          </a>
        ) : (
          <p className="mt-0.5 text-[15px] font-semibold leading-snug text-carbon-blue">
            {nextLabel}
          </p>
        )}
        {nextReason ? (
          <p className="mt-1 text-[13px] leading-relaxed text-carbon-blue/70">{nextReason}</p>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-carbon-blue/70">
        {canEditOwner ? (
          <span
            className={`inline-flex min-w-0 items-center gap-1.5 ${
              ownerAssigned ? "text-carbon-blue/70" : "font-medium text-thermal-red"
            }`}
          >
            <span>Owner</span>
            <CompanyOwnerSelect
              appearance="inline"
              label="Account owner"
              companies={companies}
              assignableUsers={assignableUsers}
              extraUsers={company.AccountOwner ? [company.AccountOwner] : []}
              value={ownerAssigned ? company.AccountOwner : null}
              disabled={ownerSaving}
              onChange={(owner) => onOwnerChange?.(owner)}
            />
          </span>
        ) : (
          <span
            className={
              ownerAssigned
                ? "text-carbon-blue/70"
                : "font-medium text-thermal-red"
            }
          >
            {ownerAssigned
              ? `Owner ${header.accountOwner}`
              : "Owner incomplete — assign an account owner"}
          </span>
        )}

        {verdict?.lastInteractionAt ? (
          <span>
            Last touch {formatRelativeTime(verdict.lastInteractionAt)}
            {verdict.lastInteractionSource === "outlook" ? " · Outlook" : ""}
          </span>
        ) : (
          <span>No recorded touch yet</span>
        )}

        {header.location !== "—" ? (
          <ActionableField icon="location" className="text-[13px] text-carbon-blue/60">
            {header.location}
          </ActionableField>
        ) : null}

        {identity.website ? (
          <ActionableField icon="website" className="text-[13px] text-carbon-blue/60">
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
          <ActionableField icon="phone" className="text-[13px] text-carbon-blue/60">
            <PhoneActionMenu phone={decodePhoneForDisplay(identity.mainPhone)} />
          </ActionableField>
        ) : null}
      </div>
    </div>
  );
}
