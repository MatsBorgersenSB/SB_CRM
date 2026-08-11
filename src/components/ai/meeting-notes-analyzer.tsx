"use client";

import { useState } from "react";
import { AUTH_ROLE_HEADER } from "@/lib/api-auth";
import type { MeetingInsights } from "@/lib/ai/meeting-intelligence";
import type { UserRole } from "@/types/auth";

/**
 * FS-014 — Paste Teams transcript / notes → proposed meeting commitments.
 * Nothing is confirmed until the user Approves in Meeting Intelligence.
 */
export function MeetingNotesAnalyzer({
  opportunityId,
  role = "superuser",
  onImported,
}: {
  opportunityId: string;
  role?: UserRole;
  onImported?: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insights, setInsights] = useState<MeetingInsights | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  if (role === "client_lead") return null;

  const analyzeOnly = async () => {
    setBusy(true);
    setError(null);
    setImportMessage(null);
    try {
      const response = await fetch("/api/ai/meeting-summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [AUTH_ROLE_HEADER]: role,
        },
        body: JSON.stringify({ rawNotes: notes, opportunityId }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        insights?: MeetingInsights;
        error?: string;
      };
      if (!response.ok || !payload.insights) {
        throw new Error(payload.error || "Could not analyze notes");
      }
      setInsights(payload.insights);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setBusy(false);
    }
  };

  const importTranscript = async () => {
    setBusy(true);
    setError(null);
    setImportMessage(null);
    try {
      const response = await fetch("/api/m365/meeting-notes/from-transcript", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [AUTH_ROLE_HEADER]: role,
        },
        body: JSON.stringify({
          transcript: notes,
          opportunityId,
          subject: "Teams meeting notes",
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        insights?: MeetingInsights;
        proposedCommitmentCount?: number;
        nextStep?: string;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Could not import transcript");
      }
      if (payload.insights) setInsights(payload.insights);
      setImportMessage(
        payload.nextStep ??
          `Saved ${payload.proposedCommitmentCount ?? 0} proposed commitment(s) for review.`,
      );
      onImported?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border border-carbon-blue/10 bg-white px-3 py-3">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
        FS-014 · Post-meeting notes
      </p>
      <h4 className="mt-0.5 text-[13px] font-semibold text-carbon-blue">
        Import Teams transcript
      </h4>
      <p className="mt-1 text-[11px] leading-relaxed text-carbon-blue/55">
        Paste the Teams transcript (or VTT). SmartAssist prepares notes — you Approve
        commitments.
      </p>
      <textarea
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        rows={4}
        placeholder="Paste Teams transcript or meeting notes…"
        className="mt-2 w-full resize-y border border-carbon-blue/15 px-2 py-1.5 text-[12px] text-carbon-blue outline-none focus:border-upcycle-orange"
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !notes.trim()}
          onClick={() => void importTranscript()}
          className="border border-upcycle-orange bg-upcycle-orange px-3 py-1.5 text-[11px] font-semibold text-white hover:brightness-105 disabled:opacity-50"
        >
          {busy ? "Working…" : "Import & propose notes"}
        </button>
        <button
          type="button"
          disabled={busy || !notes.trim()}
          onClick={() => void analyzeOnly()}
          className="border border-carbon-blue/15 bg-white px-3 py-1.5 text-[11px] font-semibold text-carbon-blue/70 hover:border-carbon-blue/30 disabled:opacity-50"
        >
          Preview only
        </button>
      </div>
      {error ? <p className="mt-2 text-[11px] text-thermal-red">{error}</p> : null}
      {importMessage ? (
        <p className="mt-2 text-[11px] text-emerald-700">{importMessage}</p>
      ) : null}
      {insights ? (
        <div className="mt-3 space-y-2 border-t border-carbon-blue/10 pt-3">
          <p className="text-[12px] text-carbon-blue/70">{insights.summary}</p>
          <p className="text-[11px] text-carbon-blue/55">
            Sentiment: {insights.sentimentLabel} · Confidence {insights.confidenceScore}
          </p>
          {insights.actionItems.length > 0 ? (
            <ul className="list-disc space-y-1 pl-4 text-[11px] text-carbon-blue/70">
              {insights.actionItems.slice(0, 6).map((item) => (
                <li key={item.action}>{item.action}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
