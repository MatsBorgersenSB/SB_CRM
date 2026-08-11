"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { NextBestActionWithCompany } from "@/lib/next-best-action-engine";
import {
  filterOpenPortfolioRecommendations,
  portfolioRecommendationKey,
  PORTFOLIO_DECISION_NOTE_MIN,
  savePortfolioRecommendationDecision,
  type PortfolioRecommendationDecision,
} from "@/lib/portfolio-recommendation-decisions";
import { company360Href } from "@/types/company-360";

/**
 * Focus → Portfolio recommendations — Yes / No with comment.
 * System recommends; user decides. No requires a short note (learning).
 */
export function PortfolioRecommendationsPanel({
  recommendations,
  limit = 4,
}: {
  recommendations: NextBestActionWithCompany[];
  limit?: number;
}) {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [tick, setTick] = useState(0);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [pendingDecision, setPendingDecision] =
    useState<PortfolioRecommendationDecision | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setHydrated(true), []);

  const openItems = useMemo(() => {
    void tick;
    const rows = recommendations.slice(0, Math.max(limit * 2, limit));
    const filtered = hydrated ? filterOpenPortfolioRecommendations(rows) : rows;
    return filtered.slice(0, limit);
  }, [recommendations, limit, hydrated, tick]);

  if (openItems.length === 0) {
    return (
      <p className="text-sm text-carbon-blue/45">
        No open portfolio recommendations — you have decided what matters for now.
      </p>
    );
  }

  const beginDecision = (
    key: string,
    decision: PortfolioRecommendationDecision,
  ) => {
    setActiveKey(key);
    setPendingDecision(decision);
    setNote("");
    setError(null);
  };

  const confirm = (item: NextBestActionWithCompany) => {
    if (!pendingDecision) return;
    const key = portfolioRecommendationKey(item.companyId, item.ruleId);
    setError(null);
    try {
      savePortfolioRecommendationDecision({
        key,
        decision: pendingDecision,
        note,
        companyId: item.companyId,
        action: item.action,
      });
      setActiveKey(null);
      setPendingDecision(null);
      setNote("");
      setTick((value) => value + 1);
      if (pendingDecision === "yes") {
        router.push(company360Href(item.companyId));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your decision.");
    }
  };

  return (
    <ul className="space-y-2">
      {openItems.map((item) => {
        const key = portfolioRecommendationKey(item.companyId, item.ruleId);
        const expanded = activeKey === key && pendingDecision !== null;
        const trimmed = note.trim();
        const canConfirm =
          pendingDecision === "yes" ||
          (pendingDecision === "no" && trimmed.length >= PORTFOLIO_DECISION_NOTE_MIN);

        return (
          <li
            key={key}
            className="border border-carbon-blue/8 bg-white px-3 py-2.5"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-carbon-blue">{item.action}</p>
                <p className="mt-0.5 text-[12px] text-carbon-blue/55">
                  {item.companyName}
                  {item.reason ? (
                    <span className="text-carbon-blue/40"> — {item.reason}</span>
                  ) : null}
                </p>
              </div>

              {!expanded ? (
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => beginDecision(key, "yes")}
                    className="border border-upcycle-orange bg-upcycle-orange px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white"
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => beginDecision(key, "no")}
                    className="border border-carbon-blue/20 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/70"
                  >
                    No
                  </button>
                </div>
              ) : null}
            </div>

            {expanded ? (
              <div className="mt-3 border-t border-carbon-blue/8 pt-3">
                <p className="mb-2 text-[11px] font-medium text-carbon-blue/70">
                  {pendingDecision === "yes"
                    ? "Yes — open this company and act on the recommendation."
                    : "No — tell SmartCRM why so it stops suggesting this."}
                </p>
                <label className="block">
                  <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/40">
                    Comment{pendingDecision === "no" ? " (required)" : " (optional)"}
                  </span>
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    rows={2}
                    autoFocus
                    placeholder={
                      pendingDecision === "no"
                        ? 'e.g. "Not a sales target" or "Already handled"'
                        : 'e.g. "Calling them this afternoon"'
                    }
                    className="mt-1.5 w-full resize-none border border-carbon-blue/12 bg-white px-2.5 py-2 text-[12px] text-carbon-blue placeholder:text-carbon-blue/35 focus:border-upcycle-orange/50 focus:outline-none"
                  />
                  {pendingDecision === "no" ? (
                    <span className="mt-1 block text-[9px] text-carbon-blue/40">
                      At least {PORTFOLIO_DECISION_NOTE_MIN} characters
                      {trimmed.length > 0 ? ` · ${trimmed.length}` : ""}
                    </span>
                  ) : null}
                </label>

                {error ? (
                  <p className="mt-2 text-[11px] text-thermal-red">{error}</p>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!canConfirm}
                    onClick={() => confirm(item)}
                    className={`border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider disabled:opacity-40 ${
                      pendingDecision === "yes"
                        ? "border-upcycle-orange bg-upcycle-orange text-white"
                        : "border-carbon-blue/20 bg-white text-carbon-blue/70"
                    }`}
                  >
                    {pendingDecision === "yes" ? "Confirm Yes" : "Confirm No"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveKey(null);
                      setPendingDecision(null);
                      setNote("");
                      setError(null);
                    }}
                    className="px-2 py-1.5 text-[10px] font-semibold text-carbon-blue/45 hover:text-carbon-blue"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
