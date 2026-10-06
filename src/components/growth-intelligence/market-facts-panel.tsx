"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { AUTH_ROLE_HEADER } from "@/lib/api-auth";
import {
  MARKET_FACT_READ_LABEL,
  searchMarketFacts,
  type MarketFactDecision,
  type ResolvedMarketFact,
} from "@/lib/market-facts";
import { canUploadSmartDocs } from "@/lib/permissions";

export function MarketFactsPanel() {
  const { user } = useAuth();
  const canDecide = canUploadSmartDocs(user.role) || user.role === "admin";
  const [facts, setFacts] = useState<ResolvedMarketFact[] | null>(null);
  const [query, setQuery] = useState("");
  const [asked, setAsked] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/market-facts")
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as {
          facts?: ResolvedMarketFact[];
          error?: string;
        } | null;
        if (!response.ok) throw new Error(payload?.error || "Could not load market facts");
        if (!cancelled) setFacts(payload?.facts ?? []);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Could not load market facts");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const decide = async (factId: string, decision: MarketFactDecision) => {
    setBusyId(factId);
    setError(null);
    try {
      const response = await fetch("/api/market-facts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [AUTH_ROLE_HEADER]: user.role,
        },
        body: JSON.stringify({ factId, decision }),
      });
      const payload = (await response.json().catch(() => null)) as {
        facts?: ResolvedMarketFact[];
        error?: string;
      } | null;
      if (!response.ok || !payload?.facts) {
        throw new Error(payload?.error || "Could not save");
      }
      setFacts(payload.facts);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save");
    } finally {
      setBusyId(null);
    }
  };

  const pending = (facts ?? []).filter((fact) => !fact.decision);
  const confirmed = (facts ?? []).filter((fact) => fact.decision === "confirmed");
  const search = asked && facts ? searchMarketFacts(asked, facts) : null;

  return (
    <section className="dashboard-card p-4 sm:p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-upcycle-orange">
        Sector market
      </p>
      <h2 className="mt-1 text-[18px] font-semibold tracking-tight text-carbon-blue">
        Pyrolysis market intelligence
      </h2>
      <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-carbon-blue/70">
        Biocarbon and recoverable process heat in the Nordics and the EU. Cards from public
        sources stay in the inbox until you confirm them.
      </p>

      <form
        className="mt-3 flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setAsked(query.trim());
        }}
      >
        <label htmlFor="market-fact-ask" className="sr-only">
          Ask for market facts
        </label>
        <input
          id="market-fact-ask"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ask for market facts — e.g. Danish biochar aid"
          className="min-w-[16rem] flex-1 rounded-md border border-carbon-blue/15 bg-white px-3 py-2 text-[13px] text-carbon-blue outline-none ring-upcycle-orange/30 placeholder:text-carbon-blue/35 focus:border-upcycle-orange focus:ring-2"
        />
        <button
          type="submit"
          disabled={!query.trim()}
          className="rounded-md bg-upcycle-orange px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-upcycle-orange/90 disabled:opacity-50"
        >
          Ask
        </button>
      </form>

      {search ? (
        <div className="mt-3 rounded-md border border-carbon-blue/10 bg-carbon-blue/[0.02] px-3 py-3">
          {search.confirmed.length > 0 ? (
            <ul className="space-y-3">
              {search.confirmed.map((fact) => (
                <li key={fact.id}>
                  <FactBody fact={fact} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-carbon-blue/70">
              {search.pending.length > 0
                ? `${search.pending.length} matching fact${search.pending.length === 1 ? " is" : "s are"} in the inbox. Confirm ${search.pending.length === 1 ? "it" : "them"} before this answer is known.`
                : "No confirmed market fact matches that question."}
            </p>
          )}
        </div>
      ) : null}

      {error ? (
        <p className="mt-2 text-[12px] font-medium text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <h3 className="mt-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/45">
        {MARKET_FACT_READ_LABEL} — not confirmed
      </h3>
      {facts === null ? (
        <p className="mt-2 text-[13px] text-carbon-blue/50">Loading…</p>
      ) : pending.length === 0 ? (
        <p className="mt-2 text-[13px] text-carbon-blue/50">Inbox is clear.</p>
      ) : (
        <ul className="mt-2 space-y-3">
          {pending.map((fact) => (
            <li key={fact.id} className="border-t border-carbon-blue/8 pt-3">
              <FactBody fact={fact} />
              {canDecide ? (
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={busyId === fact.id}
                    onClick={() => void decide(fact.id, "confirmed")}
                    className="rounded-md bg-upcycle-orange/12 px-2.5 py-1 text-[11px] font-semibold text-upcycle-orange hover:bg-upcycle-orange/18 disabled:opacity-50"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    disabled={busyId === fact.id}
                    onClick={() => void decide(fact.id, "dismissed")}
                    className="rounded-md px-2.5 py-1 text-[11px] font-medium text-carbon-blue/55 hover:bg-carbon-blue/5 disabled:opacity-50"
                  >
                    Not this
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {confirmed.length > 0 ? (
        <>
          <h3 className="mt-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
            Confirmed
          </h3>
          <ul className="mt-2 space-y-3">
            {confirmed.map((fact) => (
              <li key={fact.id} className="border-t border-carbon-blue/8 pt-3">
                <FactBody fact={fact} />
                <p className="mt-1 text-[11px] font-semibold text-emerald-700">
                  Confirmed · {fact.placeLabel}
                </p>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}

function FactBody({ fact }: { fact: ResolvedMarketFact }) {
  const max = fact.budget?.reduce((peak, row) => Math.max(peak, row.millionDkk), 0) ?? 0;
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/40">
        {fact.placeLabel} · {fact.subjects.slice(0, 2).join(" · ")} · {fact.asOf}
      </p>
      <p className="mt-1 text-[14px] font-semibold text-carbon-blue">{fact.title}</p>
      <p className="mt-1 text-[13px] leading-snug text-carbon-blue/80">{fact.statement}</p>
      <p className="mt-1 text-[12px] font-medium text-upcycle-orange">{fact.offerLine}</p>
      <p className="mt-1 text-[11px] text-carbon-blue/45">Source: {fact.source}</p>
      {fact.budget && max > 0 ? (
        <div className="mt-3">
          <p className="text-[11px] text-carbon-blue/55">{fact.budgetNote}</p>
          <ul className="mt-2 space-y-1.5">
            {fact.budget.map((row) => (
              <li key={row.year} className="grid grid-cols-[3rem_1fr_4.5rem] items-center gap-2">
                <span className="text-[11px] text-carbon-blue/60">{row.year}</span>
                <span className="h-2 rounded-full bg-carbon-blue/8">
                  <span
                    className="block h-2 rounded-full bg-upcycle-orange"
                    style={{ width: `${Math.round((row.millionDkk / max) * 100)}%` }}
                  />
                </span>
                <span className="text-right text-[11px] text-carbon-blue/70">
                  {row.millionDkk} mDKK
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
