"use client";

import { useEffect, useState } from "react";
import { AUTH_ROLE_HEADER } from "@/lib/api-auth";
import { useAuth } from "@/context/auth-context";
import type { DealRiskLevel, DealVelocityNextAction } from "@/lib/ai/deal-velocity";
import { ATTIO_SURFACE, ATTIO_SURFACE_HEADER } from "@/lib/attio-workspace-surfaces";

type DealInsightsResponse = {
  success?: boolean;
  riskLevel?: DealRiskLevel;
  velocityScore?: number;
  nextBestActions?: DealVelocityNextAction[];
  signals?: string[];
  summary?: string;
  error?: string;
};

const RISK_STYLES: Record<DealRiskLevel, string> = {
  LOW: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  MEDIUM: "border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-200",
  HIGH: "border-thermal-red/35 bg-thermal-red/10 text-thermal-red",
};

/**
 * FS-012 — Deal Velocity & Next Best Action card for Opportunity Workspace.
 */
export function DealVelocityCard({ dealId }: { dealId: string }) {
  const { user } = useAuth();
  const [data, setData] = useState<DealInsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user.role === "client_lead") {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetch(`/api/ai/deal-insights/${encodeURIComponent(dealId)}`, {
      headers: { [AUTH_ROLE_HEADER]: user.role },
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as DealInsightsResponse;
        if (!response.ok) {
          throw new Error(payload.error || "Could not load deal insights");
        }
        if (!cancelled) setData(payload);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load insights");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [dealId, user.role]);

  if (user.role === "client_lead") return null;

  const risk = data?.riskLevel ?? "MEDIUM";
  const topActions = (data?.nextBestActions ?? []).slice(0, 3);

  return (
    <section
      aria-label="Deal velocity and next best action"
      className={`${ATTIO_SURFACE} overflow-hidden`}
    >
      <div className={`${ATTIO_SURFACE_HEADER} flex flex-wrap items-center justify-between gap-2`}>
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
            FS-012 · Deal Velocity
          </p>
          <h2 className="mt-0.5 text-[13px] font-semibold text-slate-800 dark:text-slate-100">
            Deal Velocity & Next Best Action
          </h2>
        </div>
        {!loading && data?.riskLevel ? (
          <span
            className={`inline-flex items-center border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${RISK_STYLES[risk]}`}
          >
            {risk} risk · {data.velocityScore ?? "—"}/100
          </span>
        ) : null}
      </div>

      <div className="px-4 py-3 sm:px-5">
        {loading ? (
          <p className="text-[12px] text-slate-500">Scoring velocity…</p>
        ) : error ? (
          <p className="text-[12px] text-thermal-red">{error}</p>
        ) : (
          <div className="space-y-3">
            {data?.summary ? (
              <p className="text-[12px] leading-relaxed text-slate-600 dark:text-slate-300">
                {data.summary}
              </p>
            ) : null}

            {topActions.length > 0 ? (
              <ul className="space-y-2">
                {topActions.map((item) => (
                  <li
                    key={item.action}
                    className="border border-slate-200/80 bg-slate-50/50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[12px] font-semibold text-slate-800 dark:text-slate-100">
                        {item.action}
                      </p>
                      <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                        {item.priority}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      {item.reason}
                    </p>
                    <p className="mt-0.5 text-[11px] text-upcycle-orange/90">
                      Impact: {item.impact}
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}

            {data?.signals && data.signals.length > 0 ? (
              <p className="text-[10px] text-slate-400">
                Signals: {data.signals.slice(0, 4).join(" · ")}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
