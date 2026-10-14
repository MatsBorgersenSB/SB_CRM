"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { marketFactsForDeal, type ResolvedMarketFact } from "@/lib/market-facts";

export function MarketFactsOnDeal({
  country,
  feedstock,
  industry,
}: {
  country?: string | null;
  feedstock?: string | null;
  industry?: string | null;
}) {
  const [facts, setFacts] = useState<ResolvedMarketFact[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/market-facts")
      .then(async (response) => {
        if (!response.ok) return;
        const payload = (await response.json().catch(() => null)) as {
          facts?: ResolvedMarketFact[];
        } | null;
        if (!cancelled) setFacts(payload?.facts ?? []);
      })
      .catch(() => {
        if (!cancelled) setFacts([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!facts) return null;
  const rows = marketFactsForDeal(facts, { country, feedstock, industry });
  const place = country?.trim() || "this country";

  return (
    <section className="rounded-lg border border-carbon-blue/10 bg-white px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-carbon-blue/65">
        From the market
      </p>
      <h2 className="mt-1 text-[16px] font-semibold text-carbon-blue">
        Confirmed facts for {place}
      </h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-[13px] leading-relaxed text-carbon-blue/60">
          No confirmed market fact covers {place}
          {feedstock?.trim() ? ` and ${feedstock.trim()}` : ""}.{" "}
          <Link href="/growth/market-intelligence" className="font-semibold text-upcycle-orange hover:underline">
            Open Market Intelligence
          </Link>{" "}
          to confirm the inbox.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {rows.map((fact) => (
            <li key={fact.id} className="border-t border-carbon-blue/8 pt-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/60">
                {fact.placeLabel}
              </p>
              <p className="mt-0.5 text-[13px] font-semibold text-carbon-blue">{fact.title}</p>
              <p className="mt-1 text-[13px] leading-snug text-carbon-blue/75">{fact.offerLine}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
