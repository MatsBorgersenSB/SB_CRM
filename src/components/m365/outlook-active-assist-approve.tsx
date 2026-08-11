"use client";

/**
 * FS-013 — Approve or No Action from Outlook without leaving the mail.
 * System recommends; user decides. Dismiss is learned.
 */

import { useState } from "react";
import { executeCoPilotProposal } from "@/lib/smartassist-copilot-client";
import { dismissCoPilotProposalWithReason } from "@/lib/smartassist-copilot-store";
import { buildSmartCrmUrl } from "@/lib/m365/outlook-context";
import type { CoPilotActionProposal } from "@/types/smartassist-copilot";

const OUTLOOK_NO_ACTION_NOTE = "No action from Outlook";

export function OutlookActiveAssistApprove({
  proposal,
  onApplied,
  onNoAction,
}: {
  proposal: CoPilotActionProposal;
  onApplied?: () => void;
  /** Called after the user explicitly chooses not to act. */
  onNoAction?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [choseNoAction, setChoseNoAction] = useState(false);

  const handleApprove = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await executeCoPilotProposal(proposal);
      if (result.mode === "applied") {
        setMessage(result.message);
        onApplied?.();
      } else {
        setMessage(result.message);
        window.open(buildSmartCrmUrl(result.href), "_blank", "noopener,noreferrer");
        onApplied?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not apply action.");
    } finally {
      setBusy(false);
    }
  };

  const handleNoAction = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await dismissCoPilotProposalWithReason({
        proposal,
        note: OUTLOOK_NO_ACTION_NOTE,
      });
      setChoseNoAction(true);
      setMessage("No action — SmartAssist will not push this again.");
      onNoAction?.();
      onApplied?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save No Action.");
    } finally {
      setBusy(false);
    }
  };

  if (choseNoAction) {
    return (
      <div className="mt-2 space-y-1.5">
        <p className="text-[11px] font-medium leading-relaxed text-carbon-blue/70">
          No action taken
        </p>
        <p className="text-[10px] leading-relaxed text-carbon-blue/45">
          You can keep reading mail — SmartAssist will not insist on this recommendation.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-1.5">
      <button
        type="button"
        disabled={busy}
        onClick={() => void handleApprove()}
        className="inline-flex w-full items-center justify-center border border-upcycle-orange bg-upcycle-orange px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Applying…" : "Approve in SmartCRM"}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => void handleNoAction()}
        className="inline-flex w-full items-center justify-center border border-carbon-blue/20 bg-white px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/70 transition-colors hover:border-carbon-blue/35 hover:text-carbon-blue disabled:opacity-50"
      >
        {busy ? "Saving…" : "No Action"}
      </button>
      {message ? (
        <p className="text-[10px] leading-relaxed text-emerald-700">{message}</p>
      ) : null}
      {error ? <p className="text-[10px] leading-relaxed text-red-600">{error}</p> : null}
    </div>
  );
}
