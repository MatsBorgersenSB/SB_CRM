"use client";

import { useCallback, useEffect, useState } from "react";
import {
  COMMISSIONING_PHASE_LABELS,
  COMMISSIONING_PHASE_OPTIONS,
  type CommissioningPhase,
  type CommissioningSummary,
} from "@/lib/execution/site-commissioning-types";

type SiteCommissioningCoPilotPanelProps = {
  projectId: string;
  onCommissioningChanged?: () => void;
};

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`border px-1.5 py-0.5 text-[9px] font-semibold ${
        ok
          ? "border-emerald-600/30 bg-emerald-50 text-emerald-800"
          : "border-carbon-blue/15 bg-carbon-blue/[0.03] text-carbon-blue/45"
      }`}
    >
      {ok ? "✓" : "○"} {label}
    </span>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`flex w-full items-center justify-between border px-3 py-2.5 text-left ${
        checked
          ? "border-emerald-600/30 bg-emerald-50"
          : "border-carbon-blue/15 bg-carbon-blue/[0.02]"
      }`}
    >
      <span className="text-[12px] font-semibold text-carbon-blue">{label}</span>
      <span
        className={`relative h-5 w-9 rounded-full transition-colors ${
          checked ? "bg-emerald-600" : "bg-carbon-blue/25"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
            checked ? "left-4" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}

export function SiteCommissioningCoPilotPanel({
  projectId,
  onCommissioningChanged,
}: SiteCommissioningCoPilotPanelProps) {
  const [summary, setSummary] = useState<CommissioningSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [phase, setPhase] = useState<CommissioningPhase>("COLD_COMMISSIONING");
  const [logTitle, setLogTitle] = useState("");
  const [safetyCheckPassed, setSafetyCheckPassed] = useState(false);
  const [atexZoningVerified, setAtexZoningVerified] = useState(false);
  const [operationalNotes, setOperationalNotes] = useState("");
  const [issuesEncountered, setIssuesEncountered] = useState("");
  const [loggedBy, setLoggedBy] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/commissioning`,
      );
      const body = (await response.json()) as {
        summary?: CommissioningSummary;
        error?: string;
      };
      if (!response.ok || !body.summary) {
        setError(body.error ?? "Failed to load commissioning");
        setSummary(null);
        return;
      }
      setSummary(body.summary);
    } catch {
      setError("Commissioning co-pilot unavailable");
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const resetModal = () => {
    setLogTitle("");
    setSafetyCheckPassed(false);
    setAtexZoningVerified(false);
    setOperationalNotes("");
    setIssuesEncountered("");
    setLoggedBy("");
    setPhase("COLD_COMMISSIONING");
  };

  const submitLog = async () => {
    if (!logTitle.trim()) {
      setError("Log title is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/commissioning`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phase,
            logTitle: logTitle.trim(),
            safetyCheckPassed,
            atexZoningVerified,
            operationalNotes: operationalNotes.trim() || null,
            issuesEncountered: issuesEncountered.trim() || null,
            loggedBy: loggedBy.trim() || null,
          }),
        },
      );
      const body = (await response.json()) as {
        summary?: CommissioningSummary;
        error?: string;
      };
      if (!response.ok || !body.summary) {
        setError(body.error ?? "Failed to log field report");
        return;
      }
      setSummary(body.summary);
      setShowModal(false);
      resetModal();
      onCommissioningChanged?.();
    } catch {
      setError("Failed to log field report");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <p className="border-t border-carbon-blue/8 px-3 py-2 text-[10px] text-carbon-blue/40">
        Loading commissioning…
      </p>
    );
  }

  return (
    <div className="border-t border-carbon-blue/8 bg-carbon-blue/[0.015] px-3 py-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            Site Commissioning
          </p>
          <p className="text-[11px] font-semibold text-carbon-blue">
            Safety Check-In Co-Pilot
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="min-h-9 border border-carbon-blue/20 bg-white px-2.5 py-1.5 text-[9px] font-semibold text-carbon-blue/80 hover:border-carbon-blue/35"
        >
          Log Daily Field & Safety Report
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge ok={!!summary?.atexVerified} label="ATEX Verified" />
        <Badge ok={!!summary?.syngasEsdTested} label="Syngas ESD Tested" />
        <Badge ok={!!summary?.thermalLimitsOk} label="Thermal Limits OK" />
        {(summary?.openSafetyItemCount ?? 0) > 0 ? (
          <span className="border border-thermal-red/30 bg-thermal-red/5 px-1.5 py-0.5 text-[9px] font-semibold text-thermal-red">
            {summary!.openSafetyItemCount} open safety item
            {summary!.openSafetyItemCount === 1 ? "" : "s"}
          </span>
        ) : (
          <span className="border border-emerald-600/25 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-800">
            No open safety holds
          </span>
        )}
      </div>

      {error ? (
        <p className="mt-2 text-[10px] text-thermal-red">{error}</p>
      ) : null}

      {/* Phase checklist */}
      <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {(summary?.phases ?? []).map((p) => (
          <div
            key={p.phase}
            className="border border-carbon-blue/10 bg-[var(--dashboard-surface)] px-2 py-1.5"
          >
            <p className="text-[9px] font-semibold text-carbon-blue">{p.label}</p>
            <p className="mt-0.5 text-[8px] text-carbon-blue/50">
              {p.logCount} log{p.logCount === 1 ? "" : "s"}
              {p.safetyEverPassed ? " · safety ✓" : ""}
              {p.atexEverVerified ? " · ATEX ✓" : ""}
            </p>
          </div>
        ))}
      </div>

      {(summary?.logs.length ?? 0) > 0 ? (
        <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto">
          {summary!.logs.slice(0, 5).map((log) => (
            <li
              key={log.id}
              className="flex items-start justify-between gap-2 text-[10px]"
            >
              <span className="min-w-0 truncate text-carbon-blue/70">
                {log.safetyCheckPassed && log.atexZoningVerified ? "✓" : "⚠"}{" "}
                {log.logTitle}
              </span>
              <span className="shrink-0 text-[8px] text-carbon-blue/40">
                {COMMISSIONING_PHASE_LABELS[log.phase]}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[10px] text-carbon-blue/50">
          No field reports yet. Log daily safety & commissioning checks on site.
        </p>
      )}

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-carbon-blue/40 p-0 sm:items-center sm:p-4">
          <div className="max-h-[92vh] w-full max-w-md overflow-y-auto border border-carbon-blue/15 bg-[var(--dashboard-surface)] p-4 shadow-lg sm:max-h-[85vh]">
            <p className="text-[13px] font-semibold text-carbon-blue">
              Daily Field & Safety Report
            </p>
            <p className="mt-0.5 text-[10px] text-carbon-blue/50">
              Failed safety or ATEX sets project At Risk and opens a safety NCR.
            </p>

            <div className="mt-3 space-y-3">
              <label className="block">
                <span className="text-[9px] font-semibold uppercase text-carbon-blue/40">
                  Report title
                </span>
                <input
                  value={logTitle}
                  onChange={(e) => setLogTitle(e.target.value)}
                  className="mt-1 min-h-11 w-full border border-carbon-blue/15 px-3 py-2 text-[14px] text-carbon-blue outline-none focus:border-carbon-blue/40"
                  placeholder="e.g. Day 3 — Hot loop start"
                />
              </label>

              <div className="flex flex-wrap gap-1.5">
                {COMMISSIONING_PHASE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPhase(opt.id)}
                    className={`min-h-9 border px-2.5 py-1.5 text-[10px] font-semibold ${
                      phase === opt.id
                        ? "border-carbon-blue bg-carbon-blue text-white"
                        : "border-carbon-blue/15 text-carbon-blue/65"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <Toggle
                  checked={safetyCheckPassed}
                  onChange={setSafetyCheckPassed}
                  label="Safety check passed"
                />
                <Toggle
                  checked={atexZoningVerified}
                  onChange={setAtexZoningVerified}
                  label="ATEX zoning verified"
                />
              </div>

              <label className="block">
                <span className="text-[9px] font-semibold uppercase text-carbon-blue/40">
                  Operational notes
                </span>
                <textarea
                  value={operationalNotes}
                  onChange={(e) => setOperationalNotes(e.target.value)}
                  rows={3}
                  className="mt-1 w-full border border-carbon-blue/15 px-3 py-2 text-[14px] text-carbon-blue outline-none"
                  placeholder="Temp / pressure / gas flow…"
                />
              </label>

              <label className="block">
                <span className="text-[9px] font-semibold uppercase text-carbon-blue/40">
                  Issues encountered
                </span>
                <textarea
                  value={issuesEncountered}
                  onChange={(e) => setIssuesEncountered(e.target.value)}
                  rows={2}
                  className="mt-1 w-full border border-carbon-blue/15 px-3 py-2 text-[14px] text-carbon-blue outline-none"
                  placeholder="Optional — leaks, trips, ESD events…"
                />
              </label>

              <label className="block">
                <span className="text-[9px] font-semibold uppercase text-carbon-blue/40">
                  Logged by
                </span>
                <input
                  value={loggedBy}
                  onChange={(e) => setLoggedBy(e.target.value)}
                  className="mt-1 min-h-11 w-full border border-carbon-blue/15 px-3 py-2 text-[14px] text-carbon-blue outline-none"
                  placeholder="Optional name"
                />
              </label>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  resetModal();
                }}
                className="min-h-11 flex-1 border border-carbon-blue/15 px-3 py-2 text-[12px] font-semibold text-carbon-blue/70"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitLog()}
                disabled={saving}
                className="min-h-11 flex-1 border border-carbon-blue bg-carbon-blue px-3 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save Report"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
