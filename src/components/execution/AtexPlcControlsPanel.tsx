"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ATEX_ZONE_LABELS,
  ATEX_ZONE_OPTIONS,
  type AtexPlcSummary,
  type AtexZone,
} from "@/lib/execution/atex-plc-types";

type AtexPlcControlsPanelProps = {
  projectId: string;
};

const ZONE_STYLES: Record<AtexZone, string> = {
  ZONE_0: "border-thermal-red/40 bg-thermal-red/10 text-thermal-red",
  ZONE_1: "border-upcycle-orange/40 bg-upcycle-orange/10 text-upcycle-orange",
  ZONE_2: "border-amber-600/30 bg-amber-50 text-amber-800",
  SAFE_AREA: "border-emerald-600/30 bg-emerald-50 text-emerald-800",
};

export function AtexPlcControlsPanel({ projectId }: AtexPlcControlsPanelProps) {
  const [summary, setSummary] = useState<AtexPlcSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [showInterlockModal, setShowInterlockModal] = useState(false);
  const [showPlcModal, setShowPlcModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Interlock form
  const [loopName, setLoopName] = useState("");
  const [atexZone, setAtexZone] = useState<AtexZone>("ZONE_1");
  const [causeDescription, setCauseDescription] = useState("");
  const [effectDescription, setEffectDescription] = useState("");

  // PLC form
  const [plcTargetName, setPlcTargetName] = useState("PLC-01 Main Automation");
  const [codeVersion, setCodeVersion] = useState("");
  const [backupChecksum, setBackupChecksum] = useState("");
  const [notes, setNotes] = useState("");
  const [totalLoopsCount, setTotalLoopsCount] = useState("0");
  const [verifiedLoopsCount, setVerifiedLoopsCount] = useState("0");
  const [deployedBy, setDeployedBy] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/atex-plc`,
      );
      const body = (await response.json()) as {
        summary?: AtexPlcSummary;
        error?: string;
      };
      if (!response.ok || !body.summary) {
        setError(body.error ?? "Failed to load ATEX/PLC controls");
        setSummary(null);
        return;
      }
      setSummary(body.summary);
    } catch {
      setError("ATEX/PLC controls unavailable");
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleVerification = async (
    interlockId: string,
    field: "isDryTested" | "isWetTested",
    value: boolean,
  ) => {
    setTogglingId(`${interlockId}:${field}`);
    setError(null);
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/atex-plc`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "verifyInterlock",
            interlockId,
            field,
            value,
          }),
        },
      );
      const body = (await response.json()) as {
        summary?: AtexPlcSummary;
        error?: string;
      };
      if (!response.ok || !body.summary) {
        setError(body.error ?? "Failed to update verification");
        return;
      }
      setSummary(body.summary);
    } catch {
      setError("Failed to update verification");
    } finally {
      setTogglingId(null);
    }
  };

  const createInterlock = async () => {
    if (!loopName.trim() || !causeDescription.trim() || !effectDescription.trim()) {
      setError("Loop name, cause, and effect are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/atex-plc`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "createInterlock",
            loopName: loopName.trim(),
            atexZone,
            causeDescription: causeDescription.trim(),
            effectDescription: effectDescription.trim(),
          }),
        },
      );
      const body = (await response.json()) as {
        summary?: AtexPlcSummary;
        error?: string;
      };
      if (!response.ok || !body.summary) {
        setError(body.error ?? "Failed to create interlock");
        return;
      }
      setSummary(body.summary);
      setShowInterlockModal(false);
      setLoopName("");
      setCauseDescription("");
      setEffectDescription("");
      setAtexZone("ZONE_1");
    } catch {
      setError("Failed to create interlock");
    } finally {
      setSaving(false);
    }
  };

  const createPlcRelease = async () => {
    if (!plcTargetName.trim() || !codeVersion.trim()) {
      setError("PLC target and code version are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/atex-plc`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "plcRelease",
            plcTargetName: plcTargetName.trim(),
            codeVersion: codeVersion.trim(),
            backupChecksum: backupChecksum.trim() || null,
            notes: notes.trim() || null,
            totalLoopsCount: Number(totalLoopsCount) || 0,
            verifiedLoopsCount: Number(verifiedLoopsCount) || 0,
            deployedBy: deployedBy.trim() || null,
          }),
        },
      );
      const body = (await response.json()) as {
        summary?: AtexPlcSummary;
        error?: string;
      };
      if (!response.ok || !body.summary) {
        setError(body.error ?? "Failed to log PLC release");
        return;
      }
      setSummary(body.summary);
      setShowPlcModal(false);
      setCodeVersion("");
      setBackupChecksum("");
      setNotes("");
      setTotalLoopsCount("0");
      setVerifiedLoopsCount("0");
      setDeployedBy("");
    } catch {
      setError("Failed to log PLC release");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <p className="border-t border-carbon-blue/8 px-3 py-2 text-[10px] text-carbon-blue/40">
        Loading ATEX & PLC controls…
      </p>
    );
  }

  const safe = summary?.safetyCheck.safeToAdvance ?? true;
  const plc = summary?.latestPlcRelease;

  return (
    <div className="border-t border-carbon-blue/8 bg-carbon-blue/[0.015] px-3 py-3 space-y-4">
      {/* Section 1 — ATEX & ESD Guardian */}
      <section>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
              Superpower #18
            </p>
            <p className="text-[11px] font-semibold text-carbon-blue">
              ATEX & ESD Safety Interlock Guardian
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowInterlockModal(true)}
            className="border border-carbon-blue/20 bg-white px-2 py-1 text-[9px] font-semibold text-carbon-blue/80"
          >
            Add Interlock
          </button>
        </div>

        <div
          className={`mt-2 border px-2.5 py-2 text-[10px] font-semibold ${
            safe
              ? "border-emerald-600/25 bg-emerald-50 text-emerald-800"
              : "border-thermal-red/30 bg-thermal-red/5 text-thermal-red"
          }`}
        >
          {safe
            ? "Zone 1/2 ESD interlocks dry-tested — safe to advance toward hot gas testing"
            : `${summary?.safetyCheck.unverifiedInterlocks.length ?? 0} Zone 1/2 interlock(s) not dry-tested — do not start hot gas testing`}
        </div>

        {(summary?.interlocks.length ?? 0) === 0 ? (
          <p className="mt-2 text-[10px] text-carbon-blue/50">
            No ESD interlocks defined. Add cause & effect loops before hot
            commissioning.
          </p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[36rem] border-collapse text-left text-[10px]">
              <thead>
                <tr className="border-b border-carbon-blue/10 text-[9px] uppercase tracking-wider text-carbon-blue/40">
                  <th className="py-1.5 pr-2 font-semibold">Loop</th>
                  <th className="py-1.5 pr-2 font-semibold">Zone</th>
                  <th className="py-1.5 pr-2 font-semibold">Cause</th>
                  <th className="py-1.5 pr-2 font-semibold">Effect</th>
                  <th className="py-1.5 font-semibold">Verify</th>
                </tr>
              </thead>
              <tbody>
                {summary!.interlocks.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-carbon-blue/8 align-top"
                  >
                    <td className="py-2 pr-2 font-semibold text-carbon-blue">
                      {row.loopName}
                    </td>
                    <td className="py-2 pr-2">
                      <span
                        className={`inline-block border px-1.5 py-0.5 text-[8px] font-semibold ${ZONE_STYLES[row.atexZone]}`}
                      >
                        {ATEX_ZONE_LABELS[row.atexZone]}
                      </span>
                    </td>
                    <td className="py-2 pr-2 text-carbon-blue/65">
                      {row.causeDescription}
                    </td>
                    <td className="py-2 pr-2 text-carbon-blue/65">
                      {row.effectDescription}
                    </td>
                    <td className="py-2">
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          disabled={togglingId === `${row.id}:isDryTested`}
                          onClick={() =>
                            void toggleVerification(
                              row.id,
                              "isDryTested",
                              !row.isDryTested,
                            )
                          }
                          className={`border px-1.5 py-0.5 text-[8px] font-semibold ${
                            row.isDryTested
                              ? "border-emerald-600/30 bg-emerald-50 text-emerald-800"
                              : "border-carbon-blue/15 text-carbon-blue/55"
                          }`}
                        >
                          {row.isDryTested ? "✓ Dry" : "Dry-Test"}
                        </button>
                        <button
                          type="button"
                          disabled={togglingId === `${row.id}:isWetTested`}
                          onClick={() =>
                            void toggleVerification(
                              row.id,
                              "isWetTested",
                              !row.isWetTested,
                            )
                          }
                          className={`border px-1.5 py-0.5 text-[8px] font-semibold ${
                            row.isWetTested
                              ? "border-emerald-600/30 bg-emerald-50 text-emerald-800"
                              : "border-carbon-blue/15 text-carbon-blue/55"
                          }`}
                        >
                          {row.isWetTested ? "✓ Wet" : "Wet-Test"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Section 2 — PLC & SCADA Versioning */}
      <section>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
              Superpower #19
            </p>
            <p className="text-[11px] font-semibold text-carbon-blue">
              PLC / SCADA Loop Check Co-Pilot
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowPlcModal(true)}
            className="border border-upcycle-orange/30 bg-upcycle-orange/10 px-2 py-1 text-[9px] font-semibold text-upcycle-orange"
          >
            Log New PLC Build Release
          </button>
        </div>

        {plc ? (
          <div className="mt-2 border border-carbon-blue/10 bg-[var(--dashboard-surface)] px-2.5 py-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold text-carbon-blue">
                  {plc.plcTargetName}
                </p>
                <p className="text-[10px] text-carbon-blue/55">
                  Version{" "}
                  <span className="font-semibold text-carbon-blue">
                    {plc.codeVersion}
                  </span>
                  {plc.deployedBy ? ` · ${plc.deployedBy}` : ""}
                  {plc.backupChecksum
                    ? ` · checksum ${plc.backupChecksum.slice(0, 12)}…`
                    : ""}
                </p>
                {plc.notes ? (
                  <p className="mt-1 text-[9px] text-carbon-blue/50">{plc.notes}</p>
                ) : null}
              </div>
              <p className="text-[10px] font-semibold text-carbon-blue">
                {plc.verifiedLoopsCount}/{plc.totalLoopsCount} loops ·{" "}
                {plc.loopVerifiedPercent}%
              </p>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden bg-carbon-blue/10">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${plc.loopVerifiedPercent}%` }}
              />
            </div>
          </div>
        ) : (
          <p className="mt-2 text-[10px] text-carbon-blue/50">
            No PLC/SCADA release logged. Record Siemens TIA / Beckhoff build tags
            before site loop checks.
          </p>
        )}
      </section>

      {error ? <p className="text-[10px] text-thermal-red">{error}</p> : null}

      {showInterlockModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-carbon-blue/40 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto border border-carbon-blue/15 bg-[var(--dashboard-surface)] p-4 shadow-lg">
            <p className="text-[12px] font-semibold text-carbon-blue">
              Add ESD Interlock
            </p>
            <div className="mt-3 space-y-2.5">
              <label className="block">
                <span className="text-[9px] font-semibold uppercase text-carbon-blue/40">
                  Loop name
                </span>
                <input
                  value={loopName}
                  onChange={(e) => setLoopName(e.target.value)}
                  className="mt-1 w-full border border-carbon-blue/15 px-2 py-1.5 text-[12px] outline-none"
                  placeholder="High Temp Pyrolysis ESD"
                />
              </label>
              <div className="flex flex-wrap gap-1">
                {ATEX_ZONE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setAtexZone(opt.id)}
                    className={`border px-2 py-1 text-[9px] font-semibold ${
                      atexZone === opt.id
                        ? ZONE_STYLES[opt.id]
                        : "border-carbon-blue/15 text-carbon-blue/65"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <label className="block">
                <span className="text-[9px] font-semibold uppercase text-carbon-blue/40">
                  Cause
                </span>
                <textarea
                  value={causeDescription}
                  onChange={(e) => setCauseDescription(e.target.value)}
                  rows={2}
                  className="mt-1 w-full border border-carbon-blue/15 px-2 py-1.5 text-[12px] outline-none"
                  placeholder="TT-101 > 750°C or PT-202 > 100 mbar"
                />
              </label>
              <label className="block">
                <span className="text-[9px] font-semibold uppercase text-carbon-blue/40">
                  Effect
                </span>
                <textarea
                  value={effectDescription}
                  onChange={(e) => setEffectDescription(e.target.value)}
                  rows={2}
                  className="mt-1 w-full border border-carbon-blue/15 px-2 py-1.5 text-[12px] outline-none"
                  placeholder="Trip feed auger, open N2 purge XV-401…"
                />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowInterlockModal(false)}
                className="border border-carbon-blue/15 px-3 py-1.5 text-[11px] font-semibold text-carbon-blue/70"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void createInterlock()}
                disabled={saving}
                className="border border-carbon-blue bg-carbon-blue px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save Interlock"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showPlcModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-carbon-blue/40 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto border border-carbon-blue/15 bg-[var(--dashboard-surface)] p-4 shadow-lg">
            <p className="text-[12px] font-semibold text-carbon-blue">
              Log New PLC Build Release
            </p>
            <div className="mt-3 space-y-2.5">
              <label className="block">
                <span className="text-[9px] font-semibold uppercase text-carbon-blue/40">
                  Target (PLC / HMI)
                </span>
                <input
                  value={plcTargetName}
                  onChange={(e) => setPlcTargetName(e.target.value)}
                  className="mt-1 w-full border border-carbon-blue/15 px-2 py-1.5 text-[12px] outline-none"
                />
              </label>
              <label className="block">
                <span className="text-[9px] font-semibold uppercase text-carbon-blue/40">
                  Code version
                </span>
                <input
                  value={codeVersion}
                  onChange={(e) => setCodeVersion(e.target.value)}
                  className="mt-1 w-full border border-carbon-blue/15 px-2 py-1.5 text-[12px] outline-none"
                  placeholder="v1.4.2-rc2 / TIA Portal tag"
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-[9px] font-semibold uppercase text-carbon-blue/40">
                    Total loops
                  </span>
                  <input
                    type="number"
                    value={totalLoopsCount}
                    onChange={(e) => setTotalLoopsCount(e.target.value)}
                    className="mt-1 w-full border border-carbon-blue/15 px-2 py-1.5 text-[12px] outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-[9px] font-semibold uppercase text-carbon-blue/40">
                    Verified loops
                  </span>
                  <input
                    type="number"
                    value={verifiedLoopsCount}
                    onChange={(e) => setVerifiedLoopsCount(e.target.value)}
                    className="mt-1 w-full border border-carbon-blue/15 px-2 py-1.5 text-[12px] outline-none"
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-[9px] font-semibold uppercase text-carbon-blue/40">
                  Backup checksum
                </span>
                <input
                  value={backupChecksum}
                  onChange={(e) => setBackupChecksum(e.target.value)}
                  className="mt-1 w-full border border-carbon-blue/15 px-2 py-1.5 text-[12px] outline-none"
                />
              </label>
              <label className="block">
                <span className="text-[9px] font-semibold uppercase text-carbon-blue/40">
                  Notes
                </span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="mt-1 w-full border border-carbon-blue/15 px-2 py-1.5 text-[12px] outline-none"
                />
              </label>
              <label className="block">
                <span className="text-[9px] font-semibold uppercase text-carbon-blue/40">
                  Deployed by
                </span>
                <input
                  value={deployedBy}
                  onChange={(e) => setDeployedBy(e.target.value)}
                  className="mt-1 w-full border border-carbon-blue/15 px-2 py-1.5 text-[12px] outline-none"
                />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPlcModal(false)}
                className="border border-carbon-blue/15 px-3 py-1.5 text-[11px] font-semibold text-carbon-blue/70"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void createPlcRelease()}
                disabled={saving}
                className="border border-carbon-blue bg-carbon-blue px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save Release"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
