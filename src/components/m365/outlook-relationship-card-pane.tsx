"use client";

import { useEffect, useMemo, useState } from "react";
import { RelationshipCard } from "@/components/m365/relationship-card";
import { OutlookAddOpportunityDialog } from "@/components/m365/outlook-add-opportunity-dialog";
import { OutlookMailTagPanel } from "@/components/m365/outlook-mail-tag-panel";
import { OutlookReconciliationCard } from "@/components/m365/outlook-reconciliation-card";
import { OutlookNoContactState } from "@/components/m365/outlook-no-contact-state";
import { openOutlookSignInDialog } from "@/components/m365/outlook-auth-gate";
import { buildSmartCrmUrl } from "@/lib/m365/outlook-context";
import { analyzeOutlookReconciliation } from "@/lib/outlook-reconciliation-engine";
import { useOutlookM365PaneLoad } from "@/hooks/use-outlook-m365-pane-load";
import type { M365RelationshipCardPayload } from "@/types/m365";

export function OutlookRelationshipCardPane() {
  const { state, resolvedEmail, resolvedDisplayName, reload } =
    useOutlookM365PaneLoad<M365RelationshipCardPayload>({
      apiPath: "/api/m365/relationship-card",
      expectedKind: "relationship-card",
      emptyMessage: "Open an email with a known contact to see relationship intelligence.",
      errorMessage: "Unable to load relationship intelligence.",
      unexpectedPayloadMessage: "Unexpected intelligence payload.",
    });

  const [reconciliationAudit, setReconciliationAudit] = useState<
    ReturnType<typeof analyzeOutlookReconciliation> | null
  >(null);
  const [opportunityDialogOpen, setOpportunityDialogOpen] = useState(false);

  useEffect(() => {
    void fetch("/api/m365/reconciliation")
      .then(async (response) => {
        if (!response.ok) return;
        const audit = (await response.json()) as ReturnType<typeof analyzeOutlookReconciliation>;
        setReconciliationAudit(audit);
      })
      .catch(() => undefined);
  }, [state.status]);

  const emailTouchpoint = useMemo(() => {
    if (!resolvedEmail || !reconciliationAudit) return null;
    const normalized = resolvedEmail.trim().toLowerCase();
    return (
      reconciliationAudit.missingTouchpoints.find(
        (row) => row.contactEmail?.trim().toLowerCase() === normalized,
      ) ?? null
    );
  }, [resolvedEmail, reconciliationAudit]);

  if (state.status === "loading") {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-white px-6">
        <p className="text-[12px] text-carbon-blue/50">Loading relationship intelligence…</p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex h-[100dvh] flex-col justify-center bg-white px-6">
        <p className="text-sm font-semibold text-carbon-blue">SmartCRM unavailable</p>
        <p className="mt-1 text-[11px] text-carbon-blue/50">{state.message}</p>
      </div>
    );
  }

  if (state.status === "auth-required") {
    return (
      <div className="flex h-[100dvh] flex-col justify-center bg-white px-6">
        <div className="w-full max-w-sm border border-carbon-blue/10 bg-carbon-blue/[0.02] p-5">
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-upcycle-orange">
            SmartCRM
          </p>
          <p className="mt-2 text-sm font-semibold text-carbon-blue">Sign In to SmartCRM</p>
          <p className="mt-1 text-[11px] leading-relaxed text-carbon-blue/50">{state.message}</p>
          <button
            type="button"
            onClick={() =>
              void openOutlookSignInDialog(() => {
                window.location.reload();
              })
            }
            className="mt-5 inline-flex w-full items-center justify-center border border-upcycle-orange bg-upcycle-orange px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-white"
          >
            Sign In to SmartCRM
          </button>
        </div>
      </div>
    );
  }

  if (state.status === "empty") {
    return (
      <div className="flex h-[100dvh] flex-col justify-center bg-white px-6">
        <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-upcycle-orange">
          SmartCRM
        </p>
        <p className="mt-2 text-sm font-semibold text-carbon-blue">No relationship context</p>
        <p className="mt-1 text-[11px] leading-relaxed text-carbon-blue/50">{state.message}</p>
      </div>
    );
  }

  if (state.status === "not-found" && resolvedEmail) {
    return (
      <OutlookNoContactState
        email={resolvedEmail}
        displayName={resolvedDisplayName}
        onContactCreated={() => {
          reload();
        }}
      />
    );
  }

  if (state.status === "ready") {
    return (
      <div className="flex min-h-[100dvh] flex-col gap-3 bg-white p-3">
        {emailTouchpoint ? (
          <OutlookReconciliationCard
            candidate={emailTouchpoint}
            compact
            onImported={() => {
              reload();
              void fetch("/api/m365/reconciliation")
                .then(async (response) => {
                  if (!response.ok) return;
                  setReconciliationAudit(await response.json());
                })
                .catch(() => undefined);
            }}
          />
        ) : null}
        {resolvedEmail ? <OutlookMailTagPanel email={resolvedEmail} /> : null}
        <RelationshipCard
          payload={state.payload}
          variant="outlook"
          onCreateOpportunity={() => setOpportunityDialogOpen(true)}
        />
        <OutlookAddOpportunityDialog
          open={opportunityDialogOpen}
          companyId={state.payload.companyId}
          companyName={state.payload.companyName}
          onClose={() => setOpportunityDialogOpen(false)}
          onCreated={() => {
            setOpportunityDialogOpen(false);
            reload();
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col justify-center bg-white px-6">
      <p className="text-sm font-semibold text-carbon-blue">No relationship context</p>
      <a
        href={buildSmartCrmUrl("/companies")}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 text-[10px] font-semibold uppercase tracking-wider text-upcycle-orange hover:underline"
      >
        Open SmartCRM
      </a>
    </div>
  );
}
