"use client";

import { useCallback, useEffect, useState } from "react";
import {
  SCOPE_REQUEST_SOURCE_LABELS,
  SCOPE_REQUEST_SOURCE_OPTIONS,
  SCOPE_STATUS_LABELS,
  type ScopeChangeRequestSource,
  type ScopeChangeStatus,
  type ScopeChangeSummary,
} from "@/lib/execution/scope-change-types";

type ScopeChangeLoggerPanelProps = {
  projectId: string;
  onScopeChanged?: () => void;
};

const STATUS_STYLES: Record<ScopeChangeStatus, string> = {
  PROPOSED: "border-upcycle-orange/30 bg-upcycle-orange/10 text-upcycle-orange",
  APPROVED: "border-emerald-600/30 bg-emerald-50 text-emerald-800",
  REJECTED: "border-carbon-blue/20 bg-carbon-blue/[0.04] text-carbon-blue/55",
};

function formatEur(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  const abs = Math.abs(value);
  return `${sign}€${abs.toLocaleString("en-EU", { maximumFractionDigits: 0 })}`;
}

function formatDays(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value)} Days`;
}

export function ScopeChangeLoggerPanel({
  projectId,
  onScopeChanged,
}: ScopeChangeLoggerPanelProps) {
  const [summary, setSummary] = useState<ScopeChangeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [changeTitle, setChangeTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requestedBy, setRequestedBy] =
    useState<ScopeChangeRequestSource>("CLIENT_REQUEST");
  const [costImpactEur, setCostImpactEur] = useState("0");
  const [scheduleImpactDays, setScheduleImpactDays] = useState("0");
  const [status, setStatus] = useState<ScopeChangeStatus>("PROPOSED");
  const [approvedBy, setApprovedBy] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/scope-change`,
      );
      const body = (await response.json()) as {
        summary?: ScopeChangeSummary;
        error?: string;
      };
      if (!response.ok || !body.summary) {
        setError(body.error ?? "Failed to load scope changes");
        setSummary(null);
        return;
      }
      setSummary(body.summary);
    } catch {
      setError("Scope change logger unavailable");
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const resetModal = () => {
    setChangeTitle("");
    setDescription("");
    setRequestedBy("CLIENT_REQUEST");
    setCostImpactEur("0");
    setScheduleImpactDays("0");
    setStatus("PROPOSED");
    setApprovedBy("");
  };

  const submitEco = async () => {
    if (!changeTitle.trim() || !description.trim()) {
      setError("Title and description are required");
      return;
    }
    const cost = Number(costImpactEur);
    const days = Number(scheduleImpactDays);
    if (!Number.isFinite(cost) || !Number.isFinite(days)) {
      setError("Cost and schedule impact must be numbers");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/scope-change`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            changeTitle: changeTitle.trim(),
            description: description.trim(),
            requestedBy,
            costImpactEur: cost,
            scheduleImpactDays: Math.round(days),
            status,
            approvedBy: approvedBy.trim() || null,
          }),
        },
      );
      const body = (await response.json()) as {
        summary?: ScopeChangeSummary;
        error?: string;
      };
      if (!response.ok || !body.summary) {
        setError(body.error ?? "Failed to log ECO");
        return;
      }
      setSummary(body.summary);
      setShowModal(false);
      resetModal();
      onScopeChanged?.();
    } catch {
      setError("Failed to log ECO");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <p className="border-t border-carbon-blue/8 px-3 py-2 text-[10px] text-carbon-blue/40">
        Loading scope changes…
      </p>
    );
  }

  return (
    <div className="border-t border-carbon-blue/8 bg-carbon-blue/[0.015] px-3 py-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            Design Freeze & Scope
          </p>
          <p className="text-[11px] font-semibold text-carbon-blue">
            Engineering Change Orders
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="border border-carbon-blue/20 bg-white px-2 py-1 text-[9px] font-semibold text-carbon-blue/80 hover:border-carbon-blue/35"
        >
          Log Engineering Change Order (ECO)
        </button>
      </div>

      {/* Cumulative delta badge */}
      <div className="mt-2 border border-carbon-blue/15 bg-[var(--dashboard-surface)] px-2.5 py-2 text-[11px] font-semibold text-carbon-blue">
        Total Change Orders:{" "}
        {formatEur(summary?.cumulativeCostImpactEur ?? 0)}
        {" | "}
        {formatDays(summary?.cumulativeScheduleImpactDays ?? 0)}
        {(summary?.openProposedCount ?? 0) > 0 ? (
          <span className="ml-2 text-[9px] font-semibold text-upcycle-orange">
            · {summary!.openProposedCount} proposed
          </span>
        ) : null}
      </div>

      {error ? (
        <p className="mt-2 text-[10px] text-thermal-red">{error}</p>
      ) : null}

      {(summary?.changes.length ?? 0) === 0 ? (
        <p className="mt-2 text-[10px] text-carbon-blue/50">
          No ECOs logged. Log scope changes after design freeze to keep Decision
          Journal and schedule impact aligned.
        </p>
      ) : (
        <div className="mt-2 max-h-40 space-y-1.5 overflow-y-auto">
          {summary!.changes.map((change) => (
            <div
              key={change.id}
              className="border border-carbon-blue/10 bg-[var(--dashboard-surface)] px-2 py-1.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[10px] font-semibold text-carbon-blue">
                    {change.changeTitle}
                  </p>
                  <p className="text-[9px] text-carbon-blue/50">
                    {SCOPE_REQUEST_SOURCE_LABELS[
                      change.requestedBy as ScopeChangeRequestSource
                    ] ?? change.requestedBy}
                    {" · "}
                    {formatEur(change.costImpactEur)}
                    {" · "}
                    {formatDays(change.scheduleImpactDays)}
                  </p>
                </div>
                <span
                  className={`shrink-0 border px-1.5 py-0.5 text-[8px] font-semibold ${STATUS_STYLES[change.status]}`}
                >
                  {SCOPE_STATUS_LABELS[change.status]}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-carbon-blue/40 p-4">
          <div className="w-full max-w-md border border-carbon-blue/15 bg-[var(--dashboard-surface)] p-4 shadow-lg">
            <p className="text-[12px] font-semibold text-carbon-blue">
              Log Engineering Change Order (ECO)
            </p>
            <p className="mt-0.5 text-[10px] text-carbon-blue/50">
              Syncs to Decision Journal (Technical). Material impacts (&gt;€10k or
              &gt;7 days) set project health to At Risk.
            </p>

            <div className="mt-3 space-y-2.5">
              <label className="block">
                <span className="text-[9px] font-semibold uppercase text-carbon-blue/40">
                  Change title
                </span>
                <input
                  value={changeTitle}
                  onChange={(e) => setChangeTitle(e.target.value)}
                  className="mt-1 w-full border border-carbon-blue/15 px-2 py-1.5 text-[12px] text-carbon-blue outline-none focus:border-carbon-blue/40"
                  placeholder="e.g. Relocate quench cooler — client request"
                />
              </label>

              <label className="block">
                <span className="text-[9px] font-semibold uppercase text-carbon-blue/40">
                  Description
                </span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="mt-1 w-full border border-carbon-blue/15 px-2 py-1.5 text-[12px] text-carbon-blue outline-none"
                  placeholder="What changed, why, and what is frozen vs open…"
                />
              </label>

              <div className="flex flex-wrap gap-1">
                {SCOPE_REQUEST_SOURCE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setRequestedBy(opt.id)}
                    className={`border px-2 py-1 text-[9px] font-semibold ${
                      requestedBy === opt.id
                        ? "border-carbon-blue bg-carbon-blue text-white"
                        : "border-carbon-blue/15 text-carbon-blue/65"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-[9px] font-semibold uppercase text-carbon-blue/40">
                    Cost impact (€)
                  </span>
                  <input
                    type="number"
                    value={costImpactEur}
                    onChange={(e) => setCostImpactEur(e.target.value)}
                    className="mt-1 w-full border border-carbon-blue/15 px-2 py-1.5 text-[12px] text-carbon-blue outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-[9px] font-semibold uppercase text-carbon-blue/40">
                    Schedule (days)
                  </span>
                  <input
                    type="number"
                    value={scheduleImpactDays}
                    onChange={(e) => setScheduleImpactDays(e.target.value)}
                    className="mt-1 w-full border border-carbon-blue/15 px-2 py-1.5 text-[12px] text-carbon-blue outline-none"
                  />
                </label>
              </div>

              <div className="flex flex-wrap gap-1">
                {(
                  ["PROPOSED", "APPROVED", "REJECTED"] as ScopeChangeStatus[]
                ).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={`border px-2 py-1 text-[9px] font-semibold ${
                      status === s
                        ? STATUS_STYLES[s]
                        : "border-carbon-blue/15 text-carbon-blue/65"
                    }`}
                  >
                    {SCOPE_STATUS_LABELS[s]}
                  </button>
                ))}
              </div>

              <label className="block">
                <span className="text-[9px] font-semibold uppercase text-carbon-blue/40">
                  Approved / logged by
                </span>
                <input
                  value={approvedBy}
                  onChange={(e) => setApprovedBy(e.target.value)}
                  className="mt-1 w-full border border-carbon-blue/15 px-2 py-1.5 text-[12px] text-carbon-blue outline-none"
                  placeholder="Optional name"
                />
              </label>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  resetModal();
                }}
                className="border border-carbon-blue/15 px-3 py-1.5 text-[11px] font-semibold text-carbon-blue/70"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitEco()}
                disabled={saving}
                className="border border-carbon-blue bg-carbon-blue px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save ECO"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
