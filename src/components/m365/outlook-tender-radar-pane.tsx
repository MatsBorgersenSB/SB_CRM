"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DeadlineBadge,
  SectorBadge,
  TechnologyBadges,
} from "@/components/prospecting/tender-chrome";
import { useAuth } from "@/context/auth-context";
import { withAuthRoleHeaders } from "@/lib/api-auth";
import { canCreateOpportunity } from "@/lib/permissions";
import type { TenderListItem } from "@/lib/tenders/types";

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
        <p className="text-sm text-muted-foreground">Loading tender radar…</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto bg-background px-4 py-4">
      <div className="flex flex-col gap-1">
        <p className="text-[11px] font-semibold tracking-tight text-primary">Tender Radar</p>
        <h1 className="font-semibold tracking-tight text-foreground">Top thermal notices</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Pyrolysis and torrefaction tenders still open. Promote only when this deserves a deal.
        </p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {tenders.length === 0 ? (
        <p className="text-sm leading-relaxed text-muted-foreground">
          No pending thermal tenders. TED is pulled every morning — SmartCRM does not invent
          notices.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {tenders.map((tender) => (
            <li
              key={tender.id}
              className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/50 p-4 backdrop-blur-sm"
            >
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                {tender.title}
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {tender.authorityName} · {tender.country}
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                <TechnologyBadges type={tender.technologyType} />
                <SectorBadge sector={tender.sectorTag} />
              </div>
              <DeadlineBadge daysLeft={tender.daysLeft} />
              {canPromote ? (
                <Button
                  size="sm"
                  disabled={busyId === tender.id}
                  onClick={() => void promote(tender.id)}
                >
                  <Check className="size-3.5" strokeWidth={2} />
                  Promote
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
