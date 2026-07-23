"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { RoleSwitcher } from "@/components/auth/role-switcher";
import { AUTH_ROLE_HEADER } from "@/lib/api-auth";
import { useAuth } from "@/context/auth-context";
import { canExportAnalytics, toEnterpriseRole } from "@/lib/security/rbac";
import type {
  AnalyticsOverview,
  PipelineVelocityMetrics,
  WeightedForecastMetrics,
  WinLossMetrics,
} from "@/lib/analytics/pipeline-analytics";
import type { Company } from "@/lib/companies-data";
import { formatDealValue } from "@/types/pipeline";
import { ATTIO_SURFACE, ATTIO_SURFACE_HEADER } from "@/lib/attio-workspace-surfaces";

type OverviewResponse = AnalyticsOverview & {
  success?: boolean;
  source?: string;
  error?: string;
};

function formatPercent(value: number): string {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="border border-carbon-blue/15 bg-white px-3 py-3">
      <div className="mb-2 h-0.5 w-8 bg-upcycle-orange/70" />
      <p className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-carbon-blue">{value}</p>
      {hint ? <p className="mt-1 text-[10px] text-carbon-blue/45">{hint}</p> : null}
    </div>
  );
}

function BreakdownBars({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; value: number; max: number; meta?: string }>;
}) {
  return (
    <section className={`${ATTIO_SURFACE} overflow-hidden`}>
      <div className={ATTIO_SURFACE_HEADER}>
        <h2 className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
          {title}
        </h2>
      </div>
      <div className="space-y-3 px-4 py-4">
        {rows.length === 0 ? (
          <p className="text-[12px] text-slate-500">No data yet.</p>
        ) : (
          rows.map((row) => {
            const width = row.max > 0 ? Math.max(4, Math.round((row.value / row.max) * 100)) : 0;
            return (
              <div key={row.label}>
                <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {row.label}
                  </span>
                  <span className="tabular-nums text-slate-500">
                    {row.meta ?? String(row.value)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-sm bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full bg-upcycle-orange/80 transition-[width]"
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function winLossBars(winLoss: WinLossMetrics) {
  const max = Math.max(winLoss.winCount, winLoss.lossCount, 1);
  return [
    {
      label: "Wins",
      value: winLoss.winCount,
      max,
      meta: `${winLoss.winCount} · ${formatPercent(winLoss.winRatePercent)}`,
    },
    {
      label: "Losses",
      value: winLoss.lossCount,
      max,
      meta: `${winLoss.lossCount} · ${formatPercent(winLoss.lossRatePercent)}`,
    },
  ];
}

function stageVelocityBars(velocity: PipelineVelocityMetrics) {
  const max = Math.max(...velocity.stageConversionRates.map((row) => row.dealCount), 1);
  return velocity.stageConversionRates.map((row) => ({
    label: row.stage,
    value: row.dealCount,
    max,
    meta:
      row.conversionToNextPercent == null
        ? `${row.dealCount} deals`
        : `${row.dealCount} · ${formatPercent(row.conversionToNextPercent)} → next`,
  }));
}

/**
 * FS-014 — Analytics & Reporting workspace (KPIs, breakdowns, CSV export).
 */
export function AnalyticsReportingWorkspace({
  companies,
}: {
  companies: Company[];
}) {
  const { user } = useAuth();
  const canExport = canExportAnalytics(user);
  const enterpriseRole = toEnterpriseRole(user.role);

  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [stage, setStage] = useState("");
  const [owner, setOwner] = useState("");

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/analytics/overview", {
        headers: { [AUTH_ROLE_HEADER]: user.role },
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => ({}))) as OverviewResponse;
      if (!response.ok) {
        throw new Error(payload.error || "Could not load analytics");
      }
      setOverview(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [user.role]);

  useEffect(() => {
    if (user.role === "client_lead") {
      setLoading(false);
      setError("Analytics is not available for client lead access.");
      return;
    }
    void loadOverview();
  }, [loadOverview, user.role]);

  const stageOptions = useMemo(() => {
    const stages = new Set<string>();
    for (const row of overview?.forecast.byStage ?? []) {
      stages.add(row.stage);
    }
    for (const row of overview?.velocity.stageConversionRates ?? []) {
      stages.add(row.stage);
    }
    return [...stages].sort();
  }, [overview]);

  const downloadCsv = useCallback(async () => {
    if (!canExport) {
      setExportError("Export requires ADMIN or MANAGER.");
      return;
    }
    setExporting(true);
    setExportError(null);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (stage) params.set("stage", stage);
      if (owner) params.set("owner", owner);

      const response = await fetch(
        `/api/analytics/export${params.toString() ? `?${params}` : ""}`,
        { headers: { [AUTH_ROLE_HEADER]: user.role } },
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Export failed");
      }

      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const disposition = response.headers.get("Content-Disposition");
      const match = disposition?.match(/filename="([^"]+)"/);
      anchor.href = href;
      anchor.download = match?.[1] ?? "smartcrm-pipeline-report.csv";
      anchor.click();
      URL.revokeObjectURL(href);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }, [canExport, from, to, stage, owner, user.role]);

  const forecast: WeightedForecastMetrics | undefined = overview?.forecast;
  const winLoss = overview?.winLoss;
  const velocity = overview?.velocity;

  return (
    <>
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-carbon-blue/15 bg-white px-4">
        <div>
          <h1 className="text-sm font-semibold text-carbon-blue">
            Analytics & Reporting
          </h1>
          <p className="text-[10px] text-carbon-blue/45">
            FS-014 · Pipeline win/loss, velocity, and weighted forecast
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="border border-carbon-blue/15 bg-carbon-blue/[0.03] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/60">
            {enterpriseRole}
          </span>
          <RoleSwitcher companies={companies} />
        </div>
      </header>

      <main className="flex-1 overflow-auto p-3">
        <div className="flex flex-col gap-3">
          {loading ? (
            <p className="text-[12px] text-carbon-blue/50">Loading analytics…</p>
          ) : error ? (
            <p className="text-[12px] text-thermal-red">{error}</p>
          ) : overview && winLoss && velocity && forecast ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <KpiCard
                  label="Win Rate"
                  value={formatPercent(winLoss.winRatePercent)}
                  hint={`${winLoss.winCount} won · ${winLoss.lossCount} lost`}
                />
                <KpiCard
                  label="Avg Cycle Time"
                  value={
                    velocity.averageCycleDays == null
                      ? "—"
                      : `${velocity.averageCycleDays} days`
                  }
                  hint={
                    velocity.sampleSize > 0
                      ? `Based on ${velocity.sampleSize} closed deals`
                      : "Need closed deals with dates"
                  }
                />
                <KpiCard
                  label="Weighted Pipeline Value"
                  value={formatDealValue(
                    forecast.currency,
                    Math.round(forecast.weightedPipelineValue),
                  )}
                  hint={`${formatDealValue(forecast.currency, Math.round(forecast.totalPipelineValue))} total · ${forecast.openDealCount} open`}
                />
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <BreakdownBars title="Win / Loss conversion" rows={winLossBars(winLoss)} />
                <BreakdownBars
                  title="Stage velocity (reach & conversion)"
                  rows={stageVelocityBars(velocity)}
                />
              </div>

              <section className={`${ATTIO_SURFACE} overflow-hidden`}>
                <div className={ATTIO_SURFACE_HEADER}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                        Deal export
                      </h2>
                      <p className="text-[11px] text-slate-500">
                        Filter by date, stage, and owner — then download CSV.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={!canExport || exporting}
                      onClick={() => void downloadCsv()}
                      className="inline-flex items-center gap-1.5 border border-upcycle-orange bg-upcycle-orange px-3 py-1.5 text-[11px] font-semibold text-white hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                      title={
                        canExport
                          ? "Download CSV report"
                          : "ADMIN or MANAGER required to export"
                      }
                    >
                      <Download className="size-3.5" strokeWidth={2} />
                      {exporting ? "Preparing…" : "Download CSV Report"}
                    </button>
                  </div>
                </div>

                <div className="space-y-3 px-4 py-4">
                  {!canExport ? (
                    <p className="text-[11px] text-amber-700">
                      CSV export is restricted to ADMIN and MANAGER roles. Your enterprise role
                      is {enterpriseRole}.
                    </p>
                  ) : null}

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45">
                      From
                      <input
                        type="date"
                        value={from}
                        onChange={(event) => setFrom(event.target.value)}
                        className="border border-carbon-blue/15 px-2 py-1.5 text-[12px] font-medium normal-case tracking-normal text-carbon-blue"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45">
                      To
                      <input
                        type="date"
                        value={to}
                        onChange={(event) => setTo(event.target.value)}
                        className="border border-carbon-blue/15 px-2 py-1.5 text-[12px] font-medium normal-case tracking-normal text-carbon-blue"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45">
                      Stage
                      <select
                        value={stage}
                        onChange={(event) => setStage(event.target.value)}
                        className="border border-carbon-blue/15 px-2 py-1.5 text-[12px] font-medium normal-case tracking-normal text-carbon-blue"
                      >
                        <option value="">All stages</option>
                        {stageOptions.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45">
                      Owner
                      <input
                        type="text"
                        value={owner}
                        onChange={(event) => setOwner(event.target.value)}
                        placeholder="Name or id…"
                        className="border border-carbon-blue/15 px-2 py-1.5 text-[12px] font-medium normal-case tracking-normal text-carbon-blue"
                      />
                    </label>
                  </div>

                  {exportError ? (
                    <p className="text-[11px] text-thermal-red">{exportError}</p>
                  ) : null}

                  <div className="overflow-x-auto border border-carbon-blue/10">
                    <table className="min-w-full text-left text-[11px]">
                      <thead className="bg-carbon-blue/[0.03] text-[9px] uppercase tracking-wider text-carbon-blue/45">
                        <tr>
                          <th className="px-3 py-2 font-semibold">Metric</th>
                          <th className="px-3 py-2 font-semibold">Value</th>
                        </tr>
                      </thead>
                      <tbody className="text-carbon-blue">
                        <tr className="border-t border-carbon-blue/10">
                          <td className="px-3 py-2">Deals in portfolio</td>
                          <td className="px-3 py-2 tabular-nums">{overview.dealCount}</td>
                        </tr>
                        <tr className="border-t border-carbon-blue/10">
                          <td className="px-3 py-2">Closed revenue (won + lost)</td>
                          <td className="px-3 py-2 tabular-nums">
                            {formatDealValue(
                              forecast.currency,
                              Math.round(winLoss.totalClosedRevenue),
                            )}
                          </td>
                        </tr>
                        <tr className="border-t border-carbon-blue/10">
                          <td className="px-3 py-2">Pipeline velocity</td>
                          <td className="px-3 py-2 tabular-nums">
                            {formatDealValue(
                              forecast.currency,
                              Math.round(velocity.pipelineVelocityPerDay),
                            )}
                            /day
                          </td>
                        </tr>
                        <tr className="border-t border-carbon-blue/10">
                          <td className="px-3 py-2">Data source</td>
                          <td className="px-3 py-2">{overview.source ?? "—"}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            </>
          ) : null}
        </div>
      </main>
    </>
  );
}
