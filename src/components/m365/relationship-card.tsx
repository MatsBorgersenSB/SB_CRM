"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { M365RelationshipCardPayload } from "@/types/m365";
import { buildSmartCrmUrl } from "@/lib/m365/outlook-context";
import { HealthRing } from "@/components/m365/health-ring";
import { ImpactContext } from "@/components/m365/impact-context";
import { NextBestActionCard } from "@/components/m365/next-best-action-card";
import { OutlookActiveAssistApprove } from "@/components/m365/outlook-active-assist-approve";
import { RelationshipHeader } from "@/components/m365/relationship-header";
import {
  hydrateCoPilotDismissalsFromServer,
  isCoPilotProposalHandled,
} from "@/lib/smartassist-copilot-store";

function BlockLabel({ children }: { children: string }) {
  return (
    <h3 className="text-[9px] font-semibold uppercase tracking-[0.14em] text-carbon-blue/38">
      {children}
    </h3>
  );
}

function CardActions({
  payload,
  outlookHost,
  onCreateOpportunity,
  onActiveAssistApplied,
  onNoAction,
  showApprove,
}: {
  payload: M365RelationshipCardPayload;
  outlookHost: boolean;
  onCreateOpportunity?: () => void;
  onActiveAssistApplied?: () => void;
  onNoAction?: () => void;
  showApprove: boolean;
}) {
  const smartCrmHref = buildSmartCrmUrl(payload.deepLink);
  const linkProps = outlookHost
    ? { target: "_blank" as const, rel: "noopener noreferrer" as const }
    : {};
  const proposal = payload.nextBestAction.activeAssistProposal;
  const pendingActivityId = payload.pendingCommitment?.activityId;
  const proposalDuplicatesCard =
    proposal?.kind === "complete_commitment" &&
    Boolean(pendingActivityId) &&
    proposal.payload.activityId === pendingActivityId;
  const canApproveInPlace = Boolean(
    outlookHost && proposal && showApprove && !proposalDuplicatesCard,
  );

  return (
    <div className="mt-3 flex flex-col gap-2">
      {canApproveInPlace && proposal ? (
        <OutlookActiveAssistApprove
          proposal={proposal}
          onApplied={onActiveAssistApplied}
          onNoAction={onNoAction}
        />
      ) : payload.nextBestAction.plannerEligible ? (
        <a
          href="https://tasks.office.com/"
          {...linkProps}
          className="inline-flex items-center justify-center border border-upcycle-orange bg-upcycle-orange px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-white transition-opacity hover:opacity-90"
        >
          Execute in Planner
        </a>
      ) : null}
      {outlookHost && !canApproveInPlace ? (
        <button
          type="button"
          onClick={onNoAction}
          className="inline-flex w-full items-center justify-center border border-carbon-blue/20 bg-white px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/70 transition-colors hover:border-carbon-blue/35 hover:text-carbon-blue"
        >
          No Action
        </button>
      ) : null}
      {outlookHost && onCreateOpportunity && payload.opportunityEligible ? (
        <button
          type="button"
          onClick={onCreateOpportunity}
          className="inline-flex items-center justify-center border border-carbon-blue/20 bg-white px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue hover:border-upcycle-orange hover:text-upcycle-orange"
        >
          Create opportunity
        </button>
      ) : null}
      {outlookHost ? (
        <a
          href={smartCrmHref}
          {...linkProps}
          className="text-center text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/55 hover:text-upcycle-orange"
        >
          Open in SmartCRM
        </a>
      ) : (
        <Link
          href={payload.deepLink}
          className="text-center text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/55 hover:text-upcycle-orange"
        >
          Open in SmartCRM
        </Link>
      )}
    </div>
  );
}

/**
 * Relationship Card — exactly five blocks, no scroll.
 * Shared by /m365-preview and Outlook add-in (variant="outlook").
 */
export function RelationshipCard({
  payload,
  variant = "default",
  onCreateOpportunity,
  onActiveAssistApplied,
}: {
  payload: M365RelationshipCardPayload;
  variant?: "default" | "outlook";
  onCreateOpportunity?: () => void;
  onActiveAssistApplied?: () => void;
}) {
  const outlookHost = variant === "outlook";
  const shellClass = outlookHost
    ? "flex h-full max-h-[100dvh] flex-col overflow-hidden bg-white"
    : "dashboard-card overflow-hidden";

  const proposal = payload.nextBestAction.activeAssistProposal;
  const [actionCleared, setActionCleared] = useState(false);
  const [approveReady, setApproveReady] = useState(!proposal);

  useEffect(() => {
    if (!outlookHost || !proposal) {
      setApproveReady(true);
      return;
    }
    let active = true;
    void (async () => {
      await hydrateCoPilotDismissalsFromServer();
      if (!active) return;
      if (isCoPilotProposalHandled(proposal.id, proposal)) {
        setActionCleared(true);
        setApproveReady(false);
      } else {
        setApproveReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [outlookHost, proposal]);

  const showRecommendedDetail = !actionCleared;

  return (
    <article className={shellClass}>
      <div
        className={`space-y-3 ${outlookHost ? "min-h-0 flex-1 overflow-y-auto px-4 py-3" : "px-5 py-5"}`}
      >
        {outlookHost ? (
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-upcycle-orange">
            SmartCRM
          </p>
        ) : null}

        <section aria-label="Relationship Health">
          <BlockLabel>Relationship Health</BlockLabel>
          {outlookHost ? (
            <p className="mt-1.5 text-[12px] font-semibold leading-snug text-carbon-blue">
              {payload.meta.whatMatters}
            </p>
          ) : null}
          <div className={`mt-2 ${outlookHost ? "flex items-start gap-3" : ""}`}>
            {outlookHost ? <HealthRing health={payload.health} size="sm" /> : null}
            <div className="min-w-0 flex-1">
              <RelationshipHeader
                companyName={payload.companyName}
                companyId={payload.companyId}
                relationshipRoleLabel={payload.relationshipRoleLabel}
                sectors={payload.sectors}
                pendingCommitment={payload.pendingCommitment}
                health={payload.health}
                hideHealthRing={outlookHost}
                deepLink={outlookHost ? undefined : payload.deepLink}
                onCommitmentCompleted={() => {
                  if (proposal?.kind === "complete_commitment") {
                    setActionCleared(true);
                  }
                  onActiveAssistApplied?.();
                }}
              />
            </div>
          </div>
        </section>

        <section aria-label="Top Risk">
          <BlockLabel>Top Risk</BlockLabel>
          {payload.topRisk ? (
            <div className="mt-2 border border-upcycle-orange/25 bg-upcycle-orange/[0.03] px-3 py-2.5">
              <p className="text-[12px] font-semibold leading-snug text-carbon-blue">
                {payload.topRisk.label}
              </p>
              {payload.topRisk.detail ? (
                <p className="mt-0.5 text-[10px] text-carbon-blue/50">{payload.topRisk.detail}</p>
              ) : null}
              <ImpactContext items={payload.topRisk.impact} />
            </div>
          ) : (
            <p className="mt-2 text-[11px] text-carbon-blue/45">No critical risks detected</p>
          )}
        </section>

        <section
          aria-label="Recommended Action"
          className="border border-upcycle-orange/35 bg-upcycle-orange/[0.05] px-3 py-3"
        >
          <BlockLabel>Recommended Action</BlockLabel>
          {showRecommendedDetail ? (
            <>
              <div className="mt-2">
                <NextBestActionCard action={payload.nextBestAction} prominent hideLinks />
              </div>
              <CardActions
                payload={payload}
                outlookHost={outlookHost}
                onCreateOpportunity={onCreateOpportunity}
                onActiveAssistApplied={onActiveAssistApplied}
                onNoAction={() => setActionCleared(true)}
                showApprove={approveReady}
              />
            </>
          ) : (
            <div className="mt-2 space-y-2">
              <p className="text-[12px] font-semibold leading-snug text-carbon-blue">
                No action for now
              </p>
              <p className="text-[10px] leading-relaxed text-carbon-blue/50">
                You chose not to act. SmartAssist will not push this recommendation again.
              </p>
              {outlookHost ? (
                <a
                  href={buildSmartCrmUrl(payload.deepLink)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-center text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/55 hover:text-upcycle-orange"
                >
                  Open in SmartCRM
                </a>
              ) : (
                <Link
                  href={payload.deepLink}
                  className="inline-block text-center text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/55 hover:text-upcycle-orange"
                >
                  Open in SmartCRM
                </Link>
              )}
            </div>
          )}
        </section>

        <section
          aria-label="Open Opportunities and Commitments"
          className="grid grid-cols-2 gap-2"
        >
          <div className="border border-carbon-blue/8 px-3 py-2.5">
            <BlockLabel>Open Opportunities</BlockLabel>
            <p className="mt-2 text-base font-semibold tabular-nums text-carbon-blue/80">
              {payload.openOpportunities.count}
            </p>
            <p className="text-[10px] text-carbon-blue/45">
              {payload.openOpportunities.valueLabel}
            </p>
            <ImpactContext items={payload.openOpportunities.impact} />
          </div>
          <div className="border border-carbon-blue/8 px-3 py-2.5">
            <BlockLabel>Open Commitments</BlockLabel>
            <p className="mt-2 text-base font-semibold tabular-nums text-carbon-blue/80">
              {payload.openCommitments.count}
            </p>
            <p className="text-[10px] text-carbon-blue/45">
              {payload.openCommitments.stateLabel}
            </p>
            <ImpactContext items={payload.openCommitments.impact} />
          </div>
        </section>
      </div>
    </article>
  );
}
