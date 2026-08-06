"use client";

import { useCallback, useEffect, useState } from "react";
import { useSignalExtract } from "@/context/signal-extract-context";

type DecisionJournalItem = {
  id: string;
  decisionText: string;
  rationale?: string | null;
  stakeholderName?: string | null;
  category: string;
  confidenceScore: number;
  createdAt: string;
};

type DecisionJournalPanelProps = {
  companyId: string;
  companyName?: string;
  refreshKey?: number;
};

export function DecisionJournalPanel({
  companyId,
  companyName,
  refreshKey = 0,
}: DecisionJournalPanelProps) {
  const { openSignalExtract } = useSignalExtract();
  const [items, setItems] = useState<DecisionJournalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/assistant/decision-journal?companyId=${encodeURIComponent(companyId)}`,
      );
      const body = (await response.json()) as {
        items?: DecisionJournalItem[];
        error?: string;
      };
      if (!response.ok) {
        setError(body.error ?? "Could not load decision journal");
        setItems([]);
        return;
      }
      setItems(body.items ?? []);
    } catch {
      setError("Decision journal unavailable");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ companyId?: string }>).detail;
      if (!detail?.companyId || detail.companyId === companyId) {
        void load();
      }
    };
    window.addEventListener("smartcrm:decision-journal-updated", handler);
    return () => window.removeEventListener("smartcrm:decision-journal-updated", handler);
  }, [companyId, load]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-carbon-blue/60">
          Decisions captured into organizational memory for this company.
        </p>
        <button
          type="button"
          onClick={() =>
            openSignalExtract({ companyId, companyName })
          }
          className="border border-upcycle-orange/30 bg-upcycle-orange/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-upcycle-orange"
        >
          Paste & Extract
        </button>
      </div>

      {loading ? (
        <p className="text-[11px] text-carbon-blue/45">Loading journal…</p>
      ) : null}
      {error ? <p className="text-[11px] text-thermal-red">{error}</p> : null}

      {!loading && !error && items.length === 0 ? (
        <p className="border border-dashed border-carbon-blue/15 px-3 py-4 text-[11px] text-carbon-blue/45">
          No decisions yet. Paste meeting notes or email to extract and save decisions.
        </p>
      ) : null}

      {items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="border border-carbon-blue/10 bg-white px-3 py-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="border border-carbon-blue/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/55">
                  {item.category}
                </span>
                <span className="text-[10px] text-carbon-blue/40">
                  {new Date(item.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="mt-1 text-sm text-carbon-blue">{item.decisionText}</p>
              {item.rationale ? (
                <p className="mt-1 text-[11px] text-carbon-blue/55">{item.rationale}</p>
              ) : null}
              {item.stakeholderName ? (
                <p className="mt-1 text-[10px] text-carbon-blue/45">
                  Stakeholder: {item.stakeholderName}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
