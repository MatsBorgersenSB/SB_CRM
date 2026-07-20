"use client";

import { useState } from "react";
import type { DealCommercialBaselineView } from "@/lib/commercial-baseline-engine";
import { buildCommercialHistory } from "@/lib/commercial-history";
import type { PipelineRow } from "@/types/pipeline";
import {
  WorkspaceTable,
  WorkspaceTableBody,
  WorkspaceTableBodyCell,
  WorkspaceTableBodyRow,
  WorkspaceTableHead,
  WorkspaceTableHeadCell,
  WorkspaceTableHeadRow,
} from "@/components/ui/workspace-table";
import { COMMERCIAL_PACKAGE_KIND_LABELS } from "@/types/commercial-package";

type CommercialSummaryPanelProps = {
  pipeline: PipelineRow;
  view: DealCommercialBaselineView;
  onViewChange: (view: DealCommercialBaselineView) => void;
};

export function CommercialSummaryPanel({
  pipeline,
  view,
  onViewChange,
}: CommercialSummaryPanelProps) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"send" | "accept" | null>(null);
  const [recipient, setRecipient] = useState(view.actions.defaultRecipient ?? "");

  const { history, latest } = buildCommercialHistory(pipeline, view.packages);

  async function handleSend() {
    const quotation = view.actions.sendableQuotation;
    if (!quotation || !recipient.trim()) return;

    setBusy("send");
    setActionError(null);

    try {
      const response = await fetch(
        `/api/deals/${encodeURIComponent(view.dealId)}/commercial-baseline/send`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quotationPackageId: quotation.PackageID,
            recipient: recipient.trim(),
          }),
        },
      );
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error ?? "Failed to send quotation");
      }
      onViewChange(body as DealCommercialBaselineView);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Send failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleAccept() {
    setBusy("accept");
    setActionError(null);

    try {
      const response = await fetch(
        `/api/deals/${encodeURIComponent(view.dealId)}/commercial-baseline/accept`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error ?? "Failed to accept transmission");
      }
      onViewChange(body as DealCommercialBaselineView);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Accept failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="border border-carbon-blue/10 bg-carbon-blue/[0.02] p-4">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-carbon-blue/55">
          Latest Commercial Position
        </h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">Value</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-carbon-blue">{latest.valueLabel}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">Date Sent</p>
            <p className="mt-1 text-sm font-medium text-carbon-blue">{latest.dateSentLabel}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">Recipient</p>
            <p className="mt-1 truncate text-sm text-carbon-blue/75">{latest.recipient}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">Status</p>
            <p className="mt-1 text-sm font-medium text-carbon-blue">
              {latest.type} · {latest.status}
            </p>
          </div>
        </div>
      </section>

      {view.actions.sendableQuotation || view.actions.canAccept ? (
        <section className="border border-upcycle-orange/20 bg-upcycle-orange/[0.03] px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-upcycle-orange">Commercial Actions</p>
          {view.actions.sendableQuotation ? (
            <div className="mt-2 flex flex-col gap-2 lg:flex-row lg:items-end">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-carbon-blue/60">
                  Send {COMMERCIAL_PACKAGE_KIND_LABELS[view.actions.sendableQuotation.kind]} to create a transmission package.
                </p>
                <input
                  type="text"
                  value={recipient}
                  onChange={(event) => setRecipient(event.target.value)}
                  placeholder="Recipient name <email@company.com>"
                  className="mt-2 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px] text-carbon-blue"
                />
              </div>
              <button
                type="button"
                disabled={busy !== null || !recipient.trim()}
                onClick={() => void handleSend()}
                className="shrink-0 border border-upcycle-orange bg-upcycle-orange px-4 py-2 text-[11px] font-semibold text-white disabled:opacity-50"
              >
                {busy === "send" ? "Sending…" : "Send quotation"}
              </button>
            </div>
          ) : null}
          {view.actions.canAccept ? (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void handleAccept()}
              className="mt-2 border border-carbon-blue bg-carbon-blue px-4 py-2 text-[11px] font-semibold text-white disabled:opacity-50"
            >
              {busy === "accept" ? "Accepting…" : "Accept transmission → baseline"}
            </button>
          ) : null}
          {actionError ? <p className="mt-2 text-[11px] text-red-600">{actionError}</p> : null}
        </section>
      ) : null}

      <div>
        <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-carbon-blue/55">
          Commercial History
        </h3>
        {history.length === 0 ? (
          <p className="text-sm text-carbon-blue/45">
            No commercial packages recorded yet — send a price indication or quotation to start the story.
          </p>
        ) : (
          <WorkspaceTable>
            <WorkspaceTableHead>
              <WorkspaceTableHeadRow>
                <WorkspaceTableHeadCell>Type</WorkspaceTableHeadCell>
                <WorkspaceTableHeadCell>Date</WorkspaceTableHeadCell>
                <WorkspaceTableHeadCell>Recipient</WorkspaceTableHeadCell>
                <WorkspaceTableHeadCell align="right">Value</WorkspaceTableHeadCell>
                <WorkspaceTableHeadCell>Status</WorkspaceTableHeadCell>
              </WorkspaceTableHeadRow>
            </WorkspaceTableHead>
            <WorkspaceTableBody>
              {history.map((row) => (
                <WorkspaceTableBodyRow key={row.id}>
                  <WorkspaceTableBodyCell className="font-medium text-carbon-blue">{row.type}</WorkspaceTableBodyCell>
                  <WorkspaceTableBodyCell className="tabular-nums text-carbon-blue/70">
                    {row.dateLabel}
                  </WorkspaceTableBodyCell>
                  <WorkspaceTableBodyCell className="truncate text-carbon-blue/70">
                    {row.recipient}
                  </WorkspaceTableBodyCell>
                  <WorkspaceTableBodyCell className="text-right font-semibold tabular-nums text-carbon-blue">
                    {row.valueLabel}
                  </WorkspaceTableBodyCell>
                  <WorkspaceTableBodyCell className="text-carbon-blue/70">{row.status}</WorkspaceTableBodyCell>
                </WorkspaceTableBodyRow>
              ))}
            </WorkspaceTableBody>
          </WorkspaceTable>
        )}
      </div>
    </div>
  );
}
