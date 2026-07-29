"use client";

import { useCallback, useEffect, useState } from "react";
import { copyTextToClipboard } from "@/lib/compose-actions";
import type { AccountReconBrief } from "@/lib/assistant/web-recon";

type ReconBattlecardPanelProps = {
  companyId: string;
  companyName?: string;
  domain?: string;
  className?: string;
};

export function ReconBattlecardPanel({
  companyId,
  companyName,
  domain,
  className = "",
}: ReconBattlecardPanelProps) {
  const [brief, setBrief] = useState<AccountReconBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openCards, setOpenCards] = useState<Set<string>>(new Set());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const applyBrief = useCallback((next: AccountReconBrief) => {
    setBrief(next);
    setOpenCards(
      new Set(next.battlecards.slice(0, 1).map((card) => card.competitorOrObjection)),
    );
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ companyId });
      if (domain) params.set("domain", domain);
      if (companyName) params.set("companyName", companyName);
      const response = await fetch(`/api/assistant/recon?${params.toString()}`);
      const body = (await response.json()) as {
        brief?: AccountReconBrief;
        error?: string;
      };
      if (!response.ok || !body.brief) {
        setError(body.error ?? "Could not load recon brief");
        setBrief(null);
        return;
      }
      applyBrief(body.brief);
    } catch {
      setError("Recon unavailable");
      setBrief(null);
    } finally {
      setLoading(false);
    }
  }, [applyBrief, companyId, companyName, domain]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const response = await fetch("/api/assistant/recon/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, domain, companyName }),
      });
      const body = (await response.json()) as {
        brief?: AccountReconBrief;
        error?: string;
      };
      if (!response.ok || !body.brief) {
        setError(body.error ?? "Refresh failed");
        return;
      }
      applyBrief(body.brief);
    } catch {
      setError("Could not refresh recon");
    } finally {
      setRefreshing(false);
    }
  }, [applyBrief, companyId, companyName, domain]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleCard = (key: string) => {
    setOpenCards((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const copyPoints = async (key: string, points: string[]) => {
    const ok = await copyTextToClipboard(points.map((p) => `• ${p}`).join("\n"));
    if (ok) {
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 1600);
    }
  };

  if (loading) {
    return (
      <p className={`text-[11px] text-carbon-blue/45 ${className}`}>
        Loading executive recon…
      </p>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            Executive Recon & Battlecards
          </p>
          <p className="text-[13px] font-semibold text-carbon-blue">
            {companyName ?? brief?.companyName ?? "Account"}
          </p>
          <p className="mt-0.5 text-[11px] text-carbon-blue/50">
            {brief?.domain
              ? brief.sourceUrl
                ? `Source: ${brief.domain}`
                : brief.domain
              : "No domain on file"}
            {brief?.cached ? " · Cached" : brief ? " · Fresh" : ""}
            {brief?.generatedAt
              ? ` · ${new Date(brief.generatedAt).toLocaleString()}`
              : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={refreshing}
          className="border border-upcycle-orange/30 bg-upcycle-orange/10 px-2.5 py-1.5 text-[11px] font-semibold text-upcycle-orange hover:bg-upcycle-orange/15 disabled:opacity-50"
        >
          {refreshing ? "Refreshing…" : "Refresh Recon"}
        </button>
      </div>

      {error ? <p className="text-[11px] text-thermal-red">{error}</p> : null}

      {brief ? (
        <>
          <div className="border border-carbon-blue/10 bg-carbon-blue/[0.02] p-3">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
              Executive summary
            </p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-carbon-blue/80">
              {brief.executiveSummary}
            </p>
            <p className="mt-2 text-[10px] text-carbon-blue/40">
              {brief.confidenceNote}
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="border border-carbon-blue/10 p-3">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                Recent signals
              </p>
              {brief.recentSignals.length === 0 ? (
                <p className="mt-2 text-[11px] text-carbon-blue/45">
                  No recent developments detected on scanned pages.
                </p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {brief.recentSignals.map((signal) => (
                    <li
                      key={signal}
                      className="text-[11px] leading-relaxed text-carbon-blue/70"
                    >
                      • {signal}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border border-carbon-blue/10 p-3">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                Perceived tech stack
              </p>
              {brief.perceivedTechStack.length === 0 ? (
                <p className="mt-2 text-[11px] text-carbon-blue/45">
                  No technology keywords detected yet.
                </p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {brief.perceivedTechStack.map((tech) => (
                    <span
                      key={tech}
                      className="border border-carbon-blue/15 bg-carbon-blue/[0.03] px-1.5 py-0.5 text-[10px] font-semibold text-carbon-blue/65"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
              Competitor & objection battlecards
            </p>
            {brief.battlecards.length === 0 ? (
              <p className="text-[11px] text-carbon-blue/45">
                No battlecards generated — refresh after adding a website.
              </p>
            ) : (
              <ul className="space-y-2">
                {brief.battlecards.map((card) => {
                  const key = card.competitorOrObjection;
                  const open = openCards.has(key);
                  return (
                    <li
                      key={key}
                      className="border border-carbon-blue/10 bg-[var(--dashboard-surface)]"
                    >
                      <button
                        type="button"
                        onClick={() => toggleCard(key)}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
                      >
                        <span className="text-[12px] font-semibold text-carbon-blue">
                          {card.competitorOrObjection}
                        </span>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                          {open ? "Hide" : "Show"}
                        </span>
                      </button>
                      {open ? (
                        <div className="border-t border-carbon-blue/8 px-3 py-3">
                          <p className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                            Win strategy
                          </p>
                          <p className="mt-1 text-[11px] leading-relaxed text-carbon-blue/70">
                            {card.winStrategy}
                          </p>

                          <div className="mt-3 flex items-center justify-between gap-2">
                            <p className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                              Talking points
                            </p>
                            <button
                              type="button"
                              onClick={() =>
                                void copyPoints(key, card.keyTalkingPoints)
                              }
                              className="border border-upcycle-orange/30 bg-upcycle-orange/10 px-2 py-1 text-[10px] font-semibold text-upcycle-orange hover:bg-upcycle-orange/15"
                            >
                              {copiedKey === key ? "Copied" : "Copy points"}
                            </button>
                          </div>
                          <ul className="mt-1.5 space-y-1">
                            {card.keyTalkingPoints.map((point) => (
                              <li
                                key={point}
                                className="text-[11px] leading-relaxed text-carbon-blue/65"
                              >
                                • {point}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
