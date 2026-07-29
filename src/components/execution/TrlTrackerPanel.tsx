"use client";

import { useCallback, useEffect, useState } from "react";
import {
  FEEDSTOCK_SUGGESTIONS,
  IP_FILING_STATUS_LABELS,
  IP_FILING_STATUS_OPTIONS,
  TRL_LADDER,
  type IpFilingStatus,
  type TrlProgressionSummary,
} from "@/lib/execution/trl-tracker-types";

type TrlTrackerPanelProps = {
  projectId: string;
  onTrlChanged?: () => void;
};

const IP_STYLES: Record<IpFilingStatus, string> = {
  NONE: "border-carbon-blue/15 bg-carbon-blue/[0.03] text-carbon-blue/45",
  PROVISIONAL_FILED:
    "border-sky-600/30 bg-sky-50 text-sky-800",
  PATENT_GRANTED: "border-emerald-600/30 bg-emerald-50 text-emerald-800",
  TRADE_SECRET: "border-violet-600/30 bg-violet-50 text-violet-800",
};

export function TrlTrackerPanel({
  projectId,
  onTrlChanged,
}: TrlTrackerPanelProps) {
  const [summary, setSummary] = useState<TrlProgressionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [experimentTitle, setExperimentTitle] = useState("");
  const [trlStage, setTrlStage] = useState(4);
  const [feedstockType, setFeedstockType] = useState("");
  const [reactorTempCelsius, setReactorTempCelsius] = useState("");
  const [residenceTimeMinutes, setResidenceTimeMinutes] = useState("");
  const [yieldPercentage, setYieldPercentage] = useState("");
  const [ipFilingStatus, setIpFilingStatus] =
    useState<IpFilingStatus>("NONE");
  const [keyFindings, setKeyFindings] = useState("");
  const [loggedBy, setLoggedBy] = useState("");
  const [validatesTargetCriteria, setValidatesTargetCriteria] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/trl`,
      );
      const body = (await response.json()) as {
        summary?: TrlProgressionSummary;
        error?: string;
      };
      if (!response.ok || !body.summary) {
        setError(body.error ?? "Failed to load TRL tracker");
        setSummary(null);
        return;
      }
      setSummary(body.summary);
      if (body.summary.currentTrlLevel != null) {
        setTrlStage(body.summary.currentTrlLevel);
      }
    } catch {
      setError("TRL tracker unavailable");
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const resetModal = () => {
    setExperimentTitle("");
    setFeedstockType("");
    setReactorTempCelsius("");
    setResidenceTimeMinutes("");
    setYieldPercentage("");
    setIpFilingStatus("NONE");
    setKeyFindings("");
    setLoggedBy("");
    setValidatesTargetCriteria(false);
  };

  const submitExperiment = async () => {
    if (!experimentTitle.trim() || !keyFindings.trim()) {
      setError("Title and key findings are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/trl`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            experimentTitle: experimentTitle.trim(),
            trlStage,
            feedstockType: feedstockType.trim() || null,
            reactorTempCelsius: reactorTempCelsius
              ? Number(reactorTempCelsius)
              : null,
            residenceTimeMinutes: residenceTimeMinutes
              ? Number(residenceTimeMinutes)
              : null,
            yieldPercentage: yieldPercentage ? Number(yieldPercentage) : null,
            ipFilingStatus,
            keyFindings: keyFindings.trim(),
            loggedBy: loggedBy.trim() || null,
            validatesTargetCriteria,
          }),
        },
      );
      const body = (await response.json()) as {
        summary?: TrlProgressionSummary;
        error?: string;
      };
      if (!response.ok || !body.summary) {
        setError(body.error ?? "Failed to log experiment");
        return;
      }
      setSummary(body.summary);
      setShowModal(false);
      resetModal();
      onTrlChanged?.();
    } catch {
      setError("Failed to log experiment");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <p className="border-t border-carbon-blue/8 px-3 py-2 text-[10px] text-carbon-blue/40">
        Loading TRL tracker…
      </p>
    );
  }

  const current = summary?.currentTrlLevel ?? 1;

  return (
    <div className="border-t border-carbon-blue/8 bg-carbon-blue/[0.015] px-3 py-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            Internal R&D
          </p>
          <p className="text-[11px] font-semibold text-carbon-blue">
            TRL & Experiment Tracker
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="border border-carbon-blue/20 bg-white px-2 py-1 text-[9px] font-semibold text-carbon-blue/80 hover:border-carbon-blue/35"
        >
          Log R&D Experiment Run
        </button>
      </div>

      {/* TRL 1–9 ladder */}
      <div className="mt-2 overflow-x-auto">
        <div className="flex min-w-max items-stretch gap-1">
          {TRL_LADDER.map((step) => {
            const isCurrent = step.level === current;
            const isDone = step.level < current;
            return (
              <div
                key={step.level}
                className={`flex w-[4.5rem] flex-col border px-1.5 py-1.5 ${
                  isCurrent
                    ? "border-upcycle-orange/40 bg-upcycle-orange/10"
                    : isDone
                      ? "border-emerald-600/25 bg-emerald-50"
                      : "border-carbon-blue/10 bg-[var(--dashboard-surface)]"
                }`}
              >
                <span
                  className={`text-[10px] font-bold ${
                    isCurrent
                      ? "text-upcycle-orange"
                      : isDone
                        ? "text-emerald-700"
                        : "text-carbon-blue/40"
                  }`}
                >
                  TRL {step.level}
                </span>
                <span className="mt-0.5 text-[8px] leading-snug text-carbon-blue/50">
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {(summary?.ipHighlights.length ?? 0) > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {summary!.ipHighlights.map((ip) => (
            <span
              key={ip}
              className={`border px-1.5 py-0.5 text-[9px] font-semibold ${IP_STYLES[ip]}`}
            >
              {IP_FILING_STATUS_LABELS[ip]}
            </span>
          ))}
        </div>
      ) : null}

      {error ? (
        <p className="mt-2 text-[10px] text-thermal-red">{error}</p>
      ) : null}

      {(summary?.experiments.length ?? 0) === 0 ? (
        <p className="mt-2 text-[10px] text-carbon-blue/50">
          No experiment runs logged. Log runs to advance TRL and preserve findings
          in Decision Journal.
        </p>
      ) : (
        <div className="mt-2 max-h-36 space-y-1.5 overflow-y-auto">
          {summary!.experiments.map((exp) => (
            <div
              key={exp.id}
              className="border border-carbon-blue/10 bg-[var(--dashboard-surface)] px-2 py-1.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[10px] font-semibold text-carbon-blue">
                    {exp.experimentTitle}
                  </p>
                  <p className="text-[9px] text-carbon-blue/50">
                    TRL {exp.trlStage}
                    {exp.feedstockType ? ` · ${exp.feedstockType}` : ""}
                    {exp.yieldPercentage != null
                      ? ` · ${exp.yieldPercentage}% yield`
                      : ""}
                  </p>
                </div>
                {exp.ipFilingStatus !== "NONE" ? (
                  <span
                    className={`shrink-0 border px-1 py-0.5 text-[8px] font-semibold ${IP_STYLES[exp.ipFilingStatus]}`}
                  >
                    {IP_FILING_STATUS_LABELS[exp.ipFilingStatus]}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 line-clamp-2 text-[9px] text-carbon-blue/60">
                {exp.keyFindings}
              </p>
            </div>
          ))}
        </div>
      )}

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-carbon-blue/40 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto border border-carbon-blue/15 bg-[var(--dashboard-surface)] p-4 shadow-lg">
            <p className="text-[12px] font-semibold text-carbon-blue">
              Log R&D Experiment Run
            </p>
            <p className="mt-0.5 text-[10px] text-carbon-blue/50">
              Findings sync to Decision Journal (Strategic). Validating criteria
              can advance project TRL.
            </p>

            <div className="mt-3 space-y-2.5">
              <label className="block">
                <span className="text-[9px] font-semibold uppercase text-carbon-blue/40">
                  Experiment title
                </span>
                <input
                  value={experimentTitle}
                  onChange={(e) => setExperimentTitle(e.target.value)}
                  className="mt-1 w-full border border-carbon-blue/15 px-2 py-1.5 text-[12px] text-carbon-blue outline-none"
                  placeholder="e.g. Pilot run — sewage sludge at 550°C"
                />
              </label>

              <div>
                <span className="text-[9px] font-semibold uppercase text-carbon-blue/40">
                  TRL stage
                </span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {TRL_LADDER.map((step) => (
                    <button
                      key={step.level}
                      type="button"
                      onClick={() => setTrlStage(step.level)}
                      className={`border px-2 py-1 text-[9px] font-semibold ${
                        trlStage === step.level
                          ? "border-upcycle-orange/40 bg-upcycle-orange/10 text-upcycle-orange"
                          : "border-carbon-blue/15 text-carbon-blue/65"
                      }`}
                    >
                      {step.level}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block">
                <span className="text-[9px] font-semibold uppercase text-carbon-blue/40">
                  Feedstock
                </span>
                <input
                  list="feedstock-suggestions"
                  value={feedstockType}
                  onChange={(e) => setFeedstockType(e.target.value)}
                  className="mt-1 w-full border border-carbon-blue/15 px-2 py-1.5 text-[12px] text-carbon-blue outline-none"
                  placeholder="Wood Chips, Sewage Sludge…"
                />
                <datalist id="feedstock-suggestions">
                  {FEEDSTOCK_SUGGESTIONS.map((f) => (
                    <option key={f} value={f} />
                  ))}
                </datalist>
              </label>

              <div className="grid grid-cols-3 gap-2">
                <label className="block">
                  <span className="text-[9px] font-semibold uppercase text-carbon-blue/40">
                    Temp °C
                  </span>
                  <input
                    type="number"
                    value={reactorTempCelsius}
                    onChange={(e) => setReactorTempCelsius(e.target.value)}
                    className="mt-1 w-full border border-carbon-blue/15 px-2 py-1.5 text-[12px] text-carbon-blue outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-[9px] font-semibold uppercase text-carbon-blue/40">
                    Residence min
                  </span>
                  <input
                    type="number"
                    value={residenceTimeMinutes}
                    onChange={(e) => setResidenceTimeMinutes(e.target.value)}
                    className="mt-1 w-full border border-carbon-blue/15 px-2 py-1.5 text-[12px] text-carbon-blue outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-[9px] font-semibold uppercase text-carbon-blue/40">
                    Yield %
                  </span>
                  <input
                    type="number"
                    value={yieldPercentage}
                    onChange={(e) => setYieldPercentage(e.target.value)}
                    className="mt-1 w-full border border-carbon-blue/15 px-2 py-1.5 text-[12px] text-carbon-blue outline-none"
                  />
                </label>
              </div>

              <div className="flex flex-wrap gap-1">
                {IP_FILING_STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setIpFilingStatus(opt.id)}
                    className={`border px-2 py-1 text-[9px] font-semibold ${
                      ipFilingStatus === opt.id
                        ? IP_STYLES[opt.id]
                        : "border-carbon-blue/15 text-carbon-blue/65"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <label className="block">
                <span className="text-[9px] font-semibold uppercase text-carbon-blue/40">
                  Key findings
                </span>
                <textarea
                  value={keyFindings}
                  onChange={(e) => setKeyFindings(e.target.value)}
                  rows={3}
                  className="mt-1 w-full border border-carbon-blue/15 px-2 py-1.5 text-[12px] text-carbon-blue outline-none"
                  placeholder="What was proven, what remains uncertain…"
                />
              </label>

              <label className="flex items-center gap-2 text-[11px] text-carbon-blue">
                <input
                  type="checkbox"
                  checked={validatesTargetCriteria}
                  onChange={(e) => setValidatesTargetCriteria(e.target.checked)}
                />
                Validates target criteria — advance project TRL
              </label>

              <label className="block">
                <span className="text-[9px] font-semibold uppercase text-carbon-blue/40">
                  Logged by
                </span>
                <input
                  value={loggedBy}
                  onChange={(e) => setLoggedBy(e.target.value)}
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
                onClick={() => void submitExperiment()}
                disabled={saving}
                className="border border-carbon-blue bg-carbon-blue px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save Experiment"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
