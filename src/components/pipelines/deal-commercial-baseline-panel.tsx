"use client";

import { useState } from "react";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import type { DealCommercialBaselineView } from "@/lib/commercial-baseline-engine";
import {
  COMMERCIAL_PACKAGE_KIND_LABELS,
} from "@/types/commercial-package";
import { CommercialPackageLink } from "@/components/relationship/relationship-links";

type DealCommercialBaselinePanelProps = {
  view: DealCommercialBaselineView;
  onViewChange: (view: DealCommercialBaselineView) => void;
  highlightPackageId?: string;
};

export function DealCommercialBaselinePanel({
  view,
  onViewChange,
  highlightPackageId,
}: DealCommercialBaselinePanelProps) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"send" | "accept" | null>(null);
  const [recipient, setRecipient] = useState(
    view.actions.defaultRecipient ?? "",
  );

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
    <div className="flex flex-col gap-4">
      {view.actions.sendableQuotation || view.actions.canAccept ? (
        <section className="border border-carbon-blue/15 bg-carbon-blue/[0.02] px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45">
            Commercial actions
          </p>
          {view.actions.sendableQuotation ? (
            <div className="mt-2 space-y-2">
              <p className="text-[10px] text-carbon-blue/60">
                Send{" "}
                {COMMERCIAL_PACKAGE_KIND_LABELS[view.actions.sendableQuotation.kind]} to
                create a transmission package.
              </p>
              <input
                type="text"
                value={recipient}
                onChange={(event) => setRecipient(event.target.value)}
                placeholder="Recipient name <email@company.com>"
                className="w-full border border-carbon-blue/15 bg-white px-2 py-1.5 text-[11px] text-carbon-blue"
              />
              <button
                type="button"
                disabled={busy !== null || !recipient.trim()}
                onClick={() => void handleSend()}
                className="border border-upcycle-orange bg-upcycle-orange px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white disabled:opacity-50"
              >
                {busy === "send" ? "Sending…" : "Send quotation"}
              </button>
            </div>
          ) : null}
          {view.actions.canAccept ? (
            <div className="mt-2">
              <p className="text-[10px] text-carbon-blue/60">
                Accept the transmitted package to freeze the commercial baseline.
              </p>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void handleAccept()}
                className="mt-2 border border-carbon-blue bg-carbon-blue px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white disabled:opacity-50"
              >
                {busy === "accept" ? "Accepting…" : "Accept quotation"}
              </button>
            </div>
          ) : null}
          {actionError ? (
            <p className="mt-2 text-[10px] text-red-600">{actionError}</p>
          ) : null}
        </section>
      ) : null}
      <section className="border border-carbon-blue/10 bg-white">
        <header className="border-b border-carbon-blue/10 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            Quotation Hierarchy
          </p>
          <p className="text-[10px] text-carbon-blue/45">
            Deal {view.dealId} · each quotation is a document set
          </p>
        </header>
        <ol className="divide-y divide-carbon-blue/10">
          {view.quotationHierarchy.map((step) => (
            <li
              key={step.kind}
              className={`px-3 py-2.5 ${
                step.package?.PackageID === highlightPackageId
                  ? "bg-upcycle-orange/[0.04] ring-1 ring-inset ring-upcycle-orange/25"
                  : ""
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-carbon-blue">{step.label}</p>
                  {step.package ? (
                    <p className="mt-0.5 text-[10px] text-carbon-blue/55">
                      <CommercialPackageLink pkg={step.package}>
                        {step.package.title}
                      </CommercialPackageLink>
                    </p>
                  ) : (
                    <p className="mt-0.5 text-[10px] text-carbon-blue/45">Not created</p>
                  )}
                </div>
              {step.package ? (
                <span className="shrink-0 border border-carbon-blue/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/55">
                  {step.package.members.length} files · {step.package.status}
                </span>
              ) : null}
            </div>
          </li>
          ))}
        </ol>
      </section>

      <CollapsibleSection
        title="Commercial narrative"
        description="What was sent, accepted, and ready to execute"
      >
        <div className="space-y-4">
          <NarrativeBlock block={view.whatWeSent} highlightPackageId={highlightPackageId} />
          <NarrativeBlock block={view.whatWasAccepted} highlightPackageId={highlightPackageId} />
          <NarrativeBlock block={view.whatToExecute} highlightPackageId={highlightPackageId} />
        </div>
      </CollapsibleSection>
    </div>
  );
}

function NarrativeBlock({
  block,
  highlightPackageId,
}: {
  block: DealCommercialBaselineView["whatWeSent"];
  highlightPackageId?: string;
}) {
  const highlighted =
    block.package?.PackageID === highlightPackageId ||
    block.package?.DocumentSetID === highlightPackageId;

  return (
    <div
      className={`border-l-2 pl-3 ${
        highlighted ? "border-upcycle-orange bg-upcycle-orange/[0.03]" : "border-upcycle-orange/30"
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-upcycle-orange">
        {block.headline}
      </p>
      <p className="mt-1 text-xs font-medium text-carbon-blue">{block.answer}</p>
      {block.package ? (
        <p className="mt-1 text-[10px]">
          <CommercialPackageLink pkg={block.package}>{block.package.title}</CommercialPackageLink>
        </p>
      ) : null}
      {block.meetingNotes.length > 0 ? (
        <ul className="mt-2 space-y-0.5">
          {block.meetingNotes.map((note) => (
            <li key={note} className="text-[10px] text-carbon-blue/60">
              {note}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
