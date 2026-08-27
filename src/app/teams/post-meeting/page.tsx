"use client";

import { useEffect, useState } from "react";
import { MeetingNotesAnalyzer } from "@/components/ai/meeting-notes-analyzer";
import { useAuth } from "@/context/auth-context";

/**
 * FS-018 Phase 3 / FS-014 — Teams post-meeting capture (paste path).
 * Propose commitments only; user Approves in Opportunity Meeting Intelligence.
 */
export default function TeamsPostMeetingPage() {
  const { user } = useAuth();
  const [opportunityId, setOpportunityId] = useState("");
  const [options, setOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/opportunities", {
          credentials: "include",
          cache: "no-store",
        });
        if (!response.ok || cancelled) {
          if (!cancelled) setLoaded(true);
          return;
        }
        const body = (await response.json()) as
          | Array<{
              id?: string;
              OpportunityID?: string;
              name?: string;
              Title?: string;
              code?: string;
            }>
          | {
              items?: Array<{
                id?: string;
                OpportunityID?: string;
                name?: string;
                Title?: string;
                code?: string;
              }>;
            };
        const rows = Array.isArray(body) ? body : (body.items ?? []);
        if (cancelled) return;
        setOptions(
          rows
            .slice(0, 40)
            .map((row) => {
              const id = String(row.id || row.OpportunityID || "");
              const name = row.name || row.Title || id;
              const code = row.code ? `${row.code} · ` : "";
              return { id, label: `${code}${name}` };
            })
            .filter((o) => o.id),
        );
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-[100dvh] space-y-4 bg-white px-4 py-5">
      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-upcycle-orange">
        SmartCRM · Post-meeting
      </p>
      <h1 className="text-base font-semibold text-carbon-blue">Capture meeting notes</h1>
      <p className="text-[12px] text-carbon-blue/55">
        Paste a Teams transcript or notes. SmartCRM proposes commitments — nothing is
        saved as confirmed until you Approve on the opportunity.
      </p>

      <label className="block text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
        Opportunity
      </label>
      <select
        value={opportunityId}
        onChange={(e) => setOpportunityId(e.target.value)}
        className="w-full border border-carbon-blue/15 px-3 py-2 text-sm"
      >
        <option value="">{loaded ? "Select opportunity…" : "Loading…"}</option>
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>

      {opportunityId ? (
        <MeetingNotesAnalyzer opportunityId={opportunityId} role={user.role} />
      ) : (
        <p className="text-[11px] text-carbon-blue/45">
          Choose the opportunity this meeting belongs to.
        </p>
      )}
    </main>
  );
}
