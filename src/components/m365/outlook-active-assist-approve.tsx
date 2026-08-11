"use client";

/**
 * FS-013 — Approve Active Assist from Outlook without leaving the mail.
 */

import { useState } from "react";
import { executeCoPilotProposal } from "@/lib/smartassist-copilot-client";
import { buildSmartCrmUrl } from "@/lib/m365/outlook-context";
import type { CoPilotActionProposal } from "@/types/smartassist-copilot";

export function OutlookActiveAssistApprove({
  proposal,
  onApplied,
}: {
  proposal: CoPilotActionProposal;
  onApplied?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      {message ? (
        <p className="text-[10px] leading-relaxed text-emerald-700">{message}</p>
      ) : null}
      {error ? <p className="text-[10px] leading-relaxed text-red-600">{error}</p> : null}
    </div>
  );
}
