"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ECI_INSTRUMENT_TYPE_LABELS,
  ECI_INSTRUMENT_TYPE_OPTIONS,
  ECI_IO_TYPE_LABELS,
  ECI_IO_TYPE_OPTIONS,
  type EciInstrumentType,
  type EciIoType,
  type EciProjectSummary,
} from "@/lib/execution/eci-traceability-types";

type EciTraceabilityPanelProps = {
  projectId: string;
};

const FILTER_CHIPS: Array<{ id: EciInstrumentType | "ALL"; label: string }> = [
  { id: "ALL", label: "All" },
  { id: "TEMPERATURE", label: "Temperature" },
  { id: "PRESSURE", label: "Pressure" },
  { id: "GAS_ANALYZER", label: "Gas Analyzer" },
  { id: "VALVE_ACTUATOR", label: "Valves" },
  { id: "SAFETY_SWITCH", label: "Safety" },
];

export function EciTraceabilityPanel({ projectId }: EciTraceabilityPanelProps) {
  const [summary, setSummary] = useState<EciProjectSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<EciInstrumentType | "ALL">("ALL");
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [tagNumber, setTagNumber] = useState("");
  const [description, setDescription] = useState("");
  const [instrumentType, setInstrumentType] =
    useState<EciInstrumentType>("TEMPERATURE");
  const [ioType, setIoType] = useState<EciIoType>("ANALOG_INPUT");
  const [exRating, setExRating] = useState("");
  const [locationZone, setLocationZone] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/eci`,
      );
      const body = (await response.json()) as {
        summary?: EciProjectSummary;
        error?: string;
      };
      if (!response.ok || !body.summary) {
        setError(body.error ?? "Failed to load EC&I tags");
        setSummary(null);
        return;
      }
      setSummary(body.summary);
    } catch {
      setError("EC&I traceability unavailable");
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const tags = summary?.tags ?? [];
    if (filter === "ALL") return tags;
    return tags.filter((t) => t.instrumentType === filter);
  }, [summary, filter]);

  const resetAdd = () => {
    setTagNumber("");
    setDescription("");
    setInstrumentType("TEMPERATURE");
    setIoType("ANALOG_INPUT");
    setExRating("");
    setLocationZone("");
  };

  const addTag = async () => {
    if (!tagNumber.trim() || !description.trim()) {
      setError("Tag number and description are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/eci`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "upsert",
            tagNumber: tagNumber.trim(),
            description: description.trim(),
            instrumentType,
            ioType,
            exRating: exRating.trim() || null,
            locationZone: locationZone.trim() || null,
          }),
        },
      );
      const body = (await response.json()) as {
        summary?: EciProjectSummary;
        error?: string;
      };
      if (!response.ok || !body.summary) {
        setError(body.error ?? "Failed to save tag");
        return;
      }
      setSummary(body.summary);
      setShowAdd(false);
      resetAdd();
    } catch {
      setError("Failed to save tag");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (
    tagId: string,
    field: "isCalibrated" | "loopChecked",
    value: boolean,
  ) => {
    setTogglingId(`${tagId}:${field}`);
    setError(null);
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/eci`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "toggle", tagId, field, value }),
        },
      );
      const body = (await response.json()) as {
        summary?: EciProjectSummary;
        error?: string;
      };
      if (!response.ok || !body.summary) {
        setError(body.error ?? "Failed to update sign-off");
        return;
      }
      setSummary(body.summary);
    } catch {
      setError("Failed to update sign-off");
    } finally {
      setTogglingId(null);
    }
  };

  if (loading) {
    return (
      <p className="border-t border-carbon-blue/8 px-3 py-2 text-[10px] text-carbon-blue/40">
        Loading EC&I IO list…
      </p>
    );
  }

  const readiness = summary?.readiness;

  return (
    <div className="border-t border-carbon-blue/8 bg-carbon-blue/[0.015] px-3 py-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            EC&I Traceability
          </p>
          <p className="text-[11px] font-semibold text-carbon-blue">
            P&ID Tags & IO List
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="border border-carbon-blue/20 bg-white px-2 py-1 text-[9px] font-semibold text-carbon-blue/80 hover:border-carbon-blue/35"
        >
          Add Instrument Tag
        </button>
      </div>

      {/* Readiness meters */}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="border border-carbon-blue/10 bg-[var(--dashboard-surface)] px-2 py-1.5">
          <p className="text-[9px] text-carbon-blue/50">Calibrated</p>
          <p className="text-[13px] font-semibold text-carbon-blue">
            {readiness?.calibratedPercent ?? 0}%
          </p>
        </div>
        <div className="border border-carbon-blue/10 bg-[var(--dashboard-surface)] px-2 py-1.5">
          <p className="text-[9px] text-carbon-blue/50">Loop checked</p>
          <p className="text-[13px] font-semibold text-carbon-blue">
            {readiness?.loopCheckedPercent ?? 0}%
          </p>
        </div>
      </div>

      {(readiness?.pendingSafetyTags.length ?? 0) > 0 ? (
        <div className="mt-2 border border-thermal-red/25 bg-thermal-red/5 px-2 py-1.5 text-[10px] text-thermal-red">
          {readiness!.pendingSafetyTags.length} critical safety tag
          {readiness!.pendingSafetyTags.length === 1 ? "" : "s"} uncalibrated
          before hot testing:{" "}
          {readiness!.pendingSafetyTags.map((t) => t.tagNumber).join(", ")}
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-1">
        {FILTER_CHIPS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => setFilter(chip.id)}
            className={`border px-2 py-0.5 text-[9px] font-semibold ${
              filter === chip.id
                ? "border-carbon-blue bg-carbon-blue text-white"
                : "border-carbon-blue/15 text-carbon-blue/65"
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="mt-2 text-[10px] text-thermal-red">{error}</p>
      ) : null}

      {filtered.length === 0 ? (
        <p className="mt-2 text-[10px] text-carbon-blue/50">
          No instrument tags yet. Add P&ID tags to track calibration and loop
          checks.
        </p>
      ) : (
        <div className="mt-2 max-h-48 space-y-1.5 overflow-y-auto">
          {filtered.map((tag) => (
            <div
              key={tag.id}
              className="border border-carbon-blue/10 bg-[var(--dashboard-surface)] px-2 py-1.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-carbon-blue">
                    {tag.tagNumber}
                  </p>
                  <p className="truncate text-[9px] text-carbon-blue/55">
                    {tag.description}
                  </p>
                  <p className="mt-0.5 text-[8px] text-carbon-blue/40">
                    {ECI_INSTRUMENT_TYPE_LABELS[tag.instrumentType]} ·{" "}
                    {ECI_IO_TYPE_LABELS[tag.ioType]}
                    {tag.exRating ? ` · ${tag.exRating}` : ""}
                    {tag.locationZone ? ` · ${tag.locationZone}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <button
                    type="button"
                    disabled={togglingId === `${tag.id}:isCalibrated`}
                    onClick={() =>
                      void toggle(tag.id, "isCalibrated", !tag.isCalibrated)
                    }
                    className={`border px-1.5 py-0.5 text-[8px] font-semibold ${
                      tag.isCalibrated
                        ? "border-emerald-600/30 bg-emerald-50 text-emerald-800"
                        : "border-carbon-blue/15 text-carbon-blue/55"
                    }`}
                  >
                    {tag.isCalibrated ? "✓ Calibrated" : "Calibrate"}
                  </button>
                  <button
                    type="button"
                    disabled={togglingId === `${tag.id}:loopChecked`}
                    onClick={() =>
                      void toggle(tag.id, "loopChecked", !tag.loopChecked)
                    }
                    className={`border px-1.5 py-0.5 text-[8px] font-semibold ${
                      tag.loopChecked
                        ? "border-emerald-600/30 bg-emerald-50 text-emerald-800"
                        : "border-carbon-blue/15 text-carbon-blue/55"
                    }`}
                  >
                    {tag.loopChecked ? "✓ Loop OK" : "Loop check"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-carbon-blue/40 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto border border-carbon-blue/15 bg-[var(--dashboard-surface)] p-4 shadow-lg">
            <p className="text-[12px] font-semibold text-carbon-blue">
              Add Instrument Tag
            </p>
            <div className="mt-3 space-y-2.5">
              <label className="block">
                <span className="text-[9px] font-semibold uppercase text-carbon-blue/40">
                  Tag number
                </span>
                <input
                  value={tagNumber}
                  onChange={(e) => setTagNumber(e.target.value)}
                  className="mt-1 w-full border border-carbon-blue/15 px-2 py-1.5 text-[12px] text-carbon-blue outline-none"
                  placeholder="TT-101, PT-202, AIT-301…"
                />
              </label>
              <label className="block">
                <span className="text-[9px] font-semibold uppercase text-carbon-blue/40">
                  Description
                </span>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 w-full border border-carbon-blue/15 px-2 py-1.5 text-[12px] text-carbon-blue outline-none"
                  placeholder="Pyrolysis Bed Temperature"
                />
              </label>
              <div className="flex flex-wrap gap-1">
                {ECI_INSTRUMENT_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setInstrumentType(opt.id)}
                    className={`border px-2 py-1 text-[9px] font-semibold ${
                      instrumentType === opt.id
                        ? "border-carbon-blue bg-carbon-blue text-white"
                        : "border-carbon-blue/15 text-carbon-blue/65"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1">
                {ECI_IO_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setIoType(opt.id)}
                    className={`border px-2 py-1 text-[9px] font-semibold ${
                      ioType === opt.id
                        ? "border-upcycle-orange/40 bg-upcycle-orange/10 text-upcycle-orange"
                        : "border-carbon-blue/15 text-carbon-blue/65"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <label className="block">
                <span className="text-[9px] font-semibold uppercase text-carbon-blue/40">
                  Ex rating
                </span>
                <input
                  value={exRating}
                  onChange={(e) => setExRating(e.target.value)}
                  className="mt-1 w-full border border-carbon-blue/15 px-2 py-1.5 text-[12px] text-carbon-blue outline-none"
                  placeholder="Ex d IIB T4 Gb"
                />
              </label>
              <label className="block">
                <span className="text-[9px] font-semibold uppercase text-carbon-blue/40">
                  Location / zone
                </span>
                <input
                  value={locationZone}
                  onChange={(e) => setLocationZone(e.target.value)}
                  className="mt-1 w-full border border-carbon-blue/15 px-2 py-1.5 text-[12px] text-carbon-blue outline-none"
                  placeholder="Zone 1 Syngas Enclosure"
                />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowAdd(false);
                  resetAdd();
                }}
                className="border border-carbon-blue/15 px-3 py-1.5 text-[11px] font-semibold text-carbon-blue/70"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void addTag()}
                disabled={saving}
                className="border border-carbon-blue bg-carbon-blue px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save Tag"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
