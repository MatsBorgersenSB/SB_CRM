"use client";

import { useCallback, useEffect, useState } from "react";
import {
  INSPECTION_STATUS_LABELS,
  INSPECTION_TYPE_LABELS,
  INSPECTION_TYPE_OPTIONS,
  type QualityInspectionRecord,
  type QualityInspectionStatus,
  type QualityInspectionType,
  type QualityProjectSummary,
} from "@/lib/execution/quality-guardian-types";
import type { StageGateMilestone } from "@/lib/execution/project-generator-types";

type QualityGateGuardianPanelProps = {
  projectId: string;
  currentStage: string;
  milestones: StageGateMilestone[];
  onQualityChanged?: () => void;
};

const STATUS_STYLES: Record<QualityInspectionStatus, string> = {
  PASSED: "border-emerald-600/30 bg-emerald-50 text-emerald-800",
  FAILED_NCR: "border-thermal-red/30 bg-thermal-red/5 text-thermal-red",
  PENDING_REMEDIATION:
    "border-upcycle-orange/30 bg-upcycle-orange/10 text-upcycle-orange",
};

export function QualityGateGuardianPanel({
  projectId,
  currentStage,
  milestones,
  onQualityChanged,
}: QualityGateGuardianPanelProps) {
  const [summary, setSummary] = useState<QualityProjectSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const [inspectionType, setInspectionType] =
    useState<QualityInspectionType>("FAT_FACTORY_TEST");
  const [status, setStatus] = useState<QualityInspectionStatus>("PASSED");
  const [title, setTitle] = useState("");
  const [milestoneId, setMilestoneId] = useState<string>("");
  const [ncrDescription, setNcrDescription] = useState("");
  const [remediationPlan, setRemediationPlan] = useState("");
  const [inspectorName, setInspectorName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/quality`,
      );
      const body = (await response.json()) as {
        summary?: QualityProjectSummary;
        error?: string;
      };
      if (!response.ok || !body.summary) {
        setError(body.error ?? "Failed to load quality gates");
        setSummary(null);
        return;
      }
      setSummary(body.summary);
    } catch {
      setError("Quality guardian unavailable");
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const current = milestones.find((m) => m.stage === currentStage);
    if (current) setMilestoneId(current.id);
  }, [milestones, currentStage]);

  const resetModal = () => {
    setTitle("");
    setNcrDescription("");
    setRemediationPlan("");
    setInspectorName("");
    setStatus("PASSED");
    setInspectionType("FAT_FACTORY_TEST");
  };

  const submitInspection = async () => {
    if (!title.trim()) {
      setError("Inspection title is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/quality`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "log",
            title: title.trim(),
            inspectionType,
            status,
            milestoneId: milestoneId || null,
            ncrDescription: ncrDescription.trim() || null,
            remediationPlan: remediationPlan.trim() || null,
            inspectorName: inspectorName.trim() || null,
          }),
        },
      );
      const body = (await response.json()) as {
        summary?: QualityProjectSummary;
        error?: string;
      };
      if (!response.ok || !body.summary) {
        setError(body.error ?? "Failed to log inspection");
        return;
      }
      setSummary(body.summary);
      setShowModal(false);
      resetModal();
      onQualityChanged?.();
    } catch {
      setError("Failed to log inspection");
    } finally {
      setSaving(false);
    }
  };

  const resolveNcr = async (inspection: QualityInspectionRecord) => {
    setResolvingId(inspection.id);
    setError(null);
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/quality`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "resolve",
            inspectionId: inspection.id,
            remediationPlan:
              inspection.remediationPlan ||
              "Corrective action verified and signed off",
          }),
        },
      );
      const body = (await response.json()) as {
        summary?: QualityProjectSummary;
        error?: string;
      };
      if (!response.ok || !body.summary) {
        setError(body.error ?? "Failed to resolve NCR");
        return;
      }
      setSummary(body.summary);
      onQualityChanged?.();
    } catch {
      setError("Failed to resolve NCR");
    } finally {
      setResolvingId(null);
    }
  };

  if (loading) {
    return (
      <p className="px-3 py-2 text-[10px] text-carbon-blue/40">
        Loading quality gates…
      </p>
    );
  }

  return (
    <div className="border-t border-carbon-blue/8 bg-carbon-blue/[0.015] px-3 py-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            Quality & ISO 9001
          </p>
          <p className="text-[11px] font-semibold text-carbon-blue">
            FAT / SAT Gate Guardian
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="border border-carbon-blue/20 bg-white px-2 py-1 text-[9px] font-semibold text-carbon-blue/80 hover:border-carbon-blue/35"
        >
          Log Inspection / NCR
        </button>
      </div>

      {/* Sign-off badges */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge ok={!!summary?.fatPassed} label="FAT" />
        <Badge ok={!!summary?.satPassed} label="SAT" />
        <Badge ok={!!summary?.isoAuditPassed} label="ISO 9001" />
        {(summary?.openNCRs.length ?? 0) > 0 ? (
          <span className="border border-thermal-red/30 bg-thermal-red/5 px-1.5 py-0.5 text-[9px] font-semibold text-thermal-red">
            {summary!.openNCRs.length} open NCR
            {summary!.openNCRs.length === 1 ? "" : "s"}
          </span>
        ) : (
          <span className="border border-emerald-600/25 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-800">
            No open NCRs
          </span>
        )}
      </div>

      {error ? (
        <p className="mt-2 text-[10px] text-thermal-red">{error}</p>
      ) : null}

      {/* Active NCR warnings */}
      {(summary?.openNCRs.length ?? 0) > 0 ? (
        <div className="mt-2 space-y-1.5">
          {summary!.openNCRs.map((ncr) => (
            <div
              key={ncr.id}
              className="border border-thermal-red/20 bg-thermal-red/[0.03] px-2 py-1.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-thermal-red">
                    {ncr.title}
                  </p>
                  <p className="text-[9px] text-carbon-blue/55">
                    {INSPECTION_TYPE_LABELS[ncr.inspectionType]}
                    {ncr.milestoneStage ? ` · ${ncr.milestoneStage}` : ""}
                  </p>
                  {ncr.ncrDescription ? (
                    <p className="mt-0.5 text-[10px] text-carbon-blue/65">
                      {ncr.ncrDescription}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => void resolveNcr(ncr)}
                  disabled={resolvingId === ncr.id}
                  className="shrink-0 border border-emerald-600/30 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-800 disabled:opacity-50"
                >
                  {resolvingId === ncr.id ? "…" : "Resolve"}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Recent inspections checklist */}
      {(summary?.inspections.length ?? 0) > 0 ? (
        <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto">
          {summary!.inspections.slice(0, 6).map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-2 text-[10px]"
            >
              <span className="truncate text-carbon-blue/70">
                {row.status === "PASSED" ? "✓" : "⚠"} {row.title}
              </span>
              <span
                className={`shrink-0 border px-1 py-0.5 text-[8px] font-semibold ${STATUS_STYLES[row.status]}`}
              >
                {INSPECTION_STATUS_LABELS[row.status]}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[10px] text-carbon-blue/45">
          No inspections logged yet. Log FAT/SAT or ISO checks before advancing
          gated stages.
        </p>
      )}

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-carbon-blue/40 p-4">
          <div className="w-full max-w-md border border-carbon-blue/15 bg-[var(--dashboard-surface)] p-4 shadow-lg">
            <p className="text-[12px] font-semibold text-carbon-blue">
              Log Inspection / NCR
            </p>
            <p className="mt-0.5 text-[10px] text-carbon-blue/50">
              ISO 9001 evidence for stage: {currentStage}
            </p>

            <div className="mt-3 space-y-2.5">
              <label className="block">
                <span className="text-[9px] font-semibold uppercase text-carbon-blue/40">
                  Title
                </span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 w-full border border-carbon-blue/15 px-2 py-1.5 text-[12px] text-carbon-blue outline-none focus:border-carbon-blue/40"
                  placeholder="e.g. FAT — Pyrolysis Unit Skid A"
                />
              </label>

              <div className="flex flex-wrap gap-1">
                {INSPECTION_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setInspectionType(opt.id)}
                    className={`border px-2 py-1 text-[9px] font-semibold ${
                      inspectionType === opt.id
                        ? "border-carbon-blue bg-carbon-blue text-white"
                        : "border-carbon-blue/15 text-carbon-blue/65"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-1">
                {(
                  [
                    "PASSED",
                    "FAILED_NCR",
                    "PENDING_REMEDIATION",
                  ] as QualityInspectionStatus[]
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
                    {INSPECTION_STATUS_LABELS[s]}
                  </button>
                ))}
              </div>

              <label className="block">
                <span className="text-[9px] font-semibold uppercase text-carbon-blue/40">
                  Linked stage
                </span>
                <select
                  value={milestoneId}
                  onChange={(e) => setMilestoneId(e.target.value)}
                  className="mt-1 w-full border border-carbon-blue/15 px-2 py-1.5 text-[12px] text-carbon-blue outline-none"
                >
                  <option value="">Project-level (blocks all advance)</option>
                  {milestones.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.stage}
                    </option>
                  ))}
                </select>
              </label>

              {status !== "PASSED" ? (
                <>
                  <label className="block">
                    <span className="text-[9px] font-semibold uppercase text-carbon-blue/40">
                      NCR description
                    </span>
                    <textarea
                      value={ncrDescription}
                      onChange={(e) => setNcrDescription(e.target.value)}
                      rows={2}
                      className="mt-1 w-full border border-carbon-blue/15 px-2 py-1.5 text-[12px] text-carbon-blue outline-none"
                      placeholder="Non-conformance details…"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[9px] font-semibold uppercase text-carbon-blue/40">
                      Remediation plan
                    </span>
                    <textarea
                      value={remediationPlan}
                      onChange={(e) => setRemediationPlan(e.target.value)}
                      rows={2}
                      className="mt-1 w-full border border-carbon-blue/15 px-2 py-1.5 text-[12px] text-carbon-blue outline-none"
                      placeholder="Corrective action required…"
                    />
                  </label>
                </>
              ) : null}

              <label className="block">
                <span className="text-[9px] font-semibold uppercase text-carbon-blue/40">
                  Inspector
                </span>
                <input
                  value={inspectorName}
                  onChange={(e) => setInspectorName(e.target.value)}
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
                onClick={() => void submitInspection()}
                disabled={saving}
                className="border border-carbon-blue bg-carbon-blue px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save Inspection"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

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
