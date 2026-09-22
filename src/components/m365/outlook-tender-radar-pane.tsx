"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { withAuthRoleHeaders } from "@/lib/api-auth";
import { canCreateOpportunity } from "@/lib/permissions";
import type { TenderListItem } from "@/lib/tenders/types";

function countdownLabel(daysLeft: number): string {
  if (daysLeft <= 0) return "⏰ Due today";
  if (daysLeft === 1) return "⏰ 1 Day Left";
  return `⏰ ${daysLeft} Days Left`;
}

export function OutlookTenderRadarPane() {
  const { user } = useAuth();
  const canPromote = canCreateOpportunity(user.role);
  const [tenders, setTenders] = useState<TenderListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/tenders?take=5", {
      cache: "no-store",
      headers: withAuthRoleHeaders(user.role),
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Unable to load tender radar.");
        }
        const payload = (await response.json()) as { tenders?: TenderListItem[] };
        if (!cancelled) setTenders(payload.tenders ?? []);
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Unable to load tender radar.");
          setTenders([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user.role]);

  async function promote(tenderId: string) {
    setBusyId(tenderId);
    setError(null);
    try {
      const response = await fetch("/api/prospecting/promote", {
        method: "POST",
        cache: "no-store",
        headers: withAuthRoleHeaders(user.role, { "Content-Type": "application/json" }),
        body: JSON.stringify({ tenderId }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Unable to promote this tender.");
      }
      setTenders((current) => (current ?? []).filter((row) => row.id !== tenderId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to promote this tender.");
    } finally {
      setBusyId(null);
    }
  }

  if (tenders === null) {
    return (
      <div className="px-4 py-6">
        <p className="text-[12px] text-carbon-blue/50">Loading tender radar…</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-auto px-4 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-upcycle-orange">
        Tender Radar
      </p>
      <p className="mt-1 text-sm font-semibold text-carbon-blue">Top thermal notices</p>
      <p className="mt-1 text-[11px] leading-relaxed text-carbon-blue/50">
        Pyrolysis and torrefaction tenders still open. Promote only when this deserves a deal.
      </p>

      {error ? <p className="mt-3 text-[11px] text-rose-700">{error}</p> : null}

      {tenders.length === 0 ? (
        <p className="mt-5 text-[12px] text-carbon-blue/45">
          No pending thermal tenders. Notices appear after ingest — SmartCRM does not invent them.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {tenders.map((tender) => (
            <li
              key={tender.id}
              className="border border-carbon-blue/10 bg-carbon-blue/[0.02] p-3"
            >
              <p className="text-[12px] font-semibold text-carbon-blue">{tender.title}</p>
              <p className="mt-1 text-[11px] text-carbon-blue/50">
                {tender.authorityName} · {tender.country}
              </p>
              <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-carbon-blue/55">
                {tender.technologyType === "Both"
                  ? "[ Pyrolysis ] [ Torrefaction ]"
                  : `[ ${tender.technologyType} ]`}{" "}
                · {tender.sectorTag}
              </p>
              <p className="mt-1 text-[11px] font-medium text-carbon-blue">
                {countdownLabel(tender.daysLeft)}
              </p>
              {canPromote ? (
                <button
                  type="button"
                  disabled={busyId === tender.id}
                  onClick={() => void promote(tender.id)}
                  className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800 disabled:opacity-50"
                >
                  ✓ Promote to Opportunity
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
