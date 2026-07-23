"use client";

import { useState } from "react";
import { AUTH_ROLE_HEADER } from "@/lib/api-auth";
import type { MeetingInsights } from "@/lib/ai/meeting-intelligence";
import type { UserRole } from "@/types/auth";

/**
 * FS-012 — Paste meeting notes → structured commitments / actions / sentiment.
 */
export function MeetingNotesAnalyzer({
  opportunityId,
  role = "superuser",
}: {
  opportunityId: string;
  role?: UserRole;
}) {
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insights, setInsights] = useState<MeetingInsights | null>(null);

  if (role === "client_lead") return null;

  const analyze = async () => {
    setBusy(true);
    setError(null);
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

  return (
    <div className="border border-carbon-blue/10 bg-white px-3 py-3">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
        FS-012 · Meeting Copilot
      </p>
      <h4 className="mt-0.5 text-[13px] font-semibold text-carbon-blue">
        Analyze meeting notes
      </h4>
      <textarea
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        rows={4}
        placeholder="Paste raw notes — commitments and action items will be extracted (no invented stakeholders)."
        className="mt-2 w-full resize-y border border-carbon-blue/15 px-2 py-1.5 text-[12px] text-carbon-blue outline-none focus:border-upcycle-orange"
      />
      <button
        type="button"
        disabled={busy || !notes.trim()}
        onClick={() => void analyze()}
        className="mt-2 border border-upcycle-orange bg-upcycle-orange px-3 py-1.5 text-[11px] font-semibold text-white hover:brightness-105 disabled:opacity-50"
      >
        {busy ? "Analyzing…" : "Extract insights"}
      </button>
      {error ? <p className="mt-2 text-[11px] text-thermal-red">{error}</p> : null}
      {insights ? (
        <div className="mt-3 space-y-2 border-t border-carbon-blue/10 pt-3">
          <p className="text-[12px] text-carbon-blue/70">{insights.summary}</p>
          <p className="text-[11px] text-carbon-blue/55">
            Sentiment: {insights.sentimentLabel} ({insights.sentimentScore}) · Confidence{" "}
            {insights.confidenceScore}%
          </p>
          {insights.keyCommitments.length > 0 ? (
            <ul className="list-disc space-y-1 pl-4 text-[12px] text-carbon-blue">
              {insights.keyCommitments.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
          {insights.actionItems.length > 0 ? (
            <ul className="space-y-1.5">
              {insights.actionItems.map((item) => (
                <li
                  key={item.action}
                  className="border border-carbon-blue/10 px-2 py-1.5 text-[12px] text-carbon-blue"
                >
                  <span className="font-semibold">{item.action}</span>
                  <span className="ml-2 text-[10px] uppercase tracking-wider text-carbon-blue/40">
                    {item.priority}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
