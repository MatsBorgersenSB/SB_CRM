"use client";

import { useEffect, useState } from "react";
import type { ExtractedSignals } from "@/lib/assistant/signal-extractor";

type SignalExtractModalProps = {
  open: boolean;
  onClose: () => void;
  companyId?: string;
  companyName?: string;
  opportunityId?: string;
  onSaved?: () => void;
};

export function SignalExtractModal({
  open,
  onClose,
  companyId,
  companyName,
  opportunityId,
  onSaved,
}: SignalExtractModalProps) {
  const [rawText, setRawText] = useState("");
  const [signals, setSignals] = useState<ExtractedSignals | null>(null);
  const [busy, setBusy] = useState<"extract" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveSummary, setSaveSummary] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSaveSummary(null);
  }, [open]);

  if (!open) return null;

  const handleExtract = async () => {
    if (!rawText.trim()) {
      setError("Paste meeting notes, email, or transcript text first.");
      return;
    }
    setBusy("extract");
    setError(null);
    setSaveSummary(null);
    try {
      const response = await fetch("/api/assistant/extract-signals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText,
          companyId,
          opportunityId,
          persist: false,
        }),
      });
      const body = (await response.json()) as {
        signals?: ExtractedSignals;
        error?: string;
      };
      if (!response.ok) {
        setError(body.error ?? "Extraction failed");
        setSignals(null);
        return;
      }
      setSignals(body.signals ?? null);
    } catch {
      setError("Extraction unavailable");
    } finally {
      setBusy(null);
    }
  };

  const handleSave = async () => {
    if (!rawText.trim() || !signals) return;
    setBusy("save");
    setError(null);
    try {
      const response = await fetch("/api/assistant/extract-signals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText,
          companyId,
          opportunityId,
          persist: true,
          signals,
        }),
      });
      const body = (await response.json()) as {
        error?: string;
        decisionsSaved?: number;
        tasksCreated?: number;
        risksSaved?: number;
      };
      if (!response.ok) {
        setError(body.error ?? "Save failed");
        return;
      }
      setSaveSummary(
        `Saved ${body.decisionsSaved ?? 0} decision(s), ${body.tasksCreated ?? 0} task(s), ${body.risksSaved ?? 0} risk note(s).`,
      );
      onSaved?.();
      window.dispatchEvent(
        new CustomEvent("smartcrm:decision-journal-updated", {
          detail: { companyId },
        }),
      );
    } catch {
      setError("Could not save to organizational memory");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-carbon-blue/30">
      <button
        type="button"
        aria-label="Close overlay"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <aside className="relative z-10 flex h-full w-full max-w-xl flex-col border-l border-carbon-blue/15 bg-white shadow-xl">
        <header className="flex items-start justify-between gap-3 border-b border-carbon-blue/10 px-4 py-3">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
              SmartAssist · Zero-Touch Extraction
            </p>
            <h2 className="mt-0.5 text-sm font-semibold text-carbon-blue">
              Paste & Extract Intelligence
            </h2>
            {companyName || companyId ? (
              <p className="mt-1 text-[11px] text-carbon-blue/55">
                Linked to {companyName || companyId}
                {opportunityId ? ` · ${opportunityId}` : ""}
              </p>
            ) : (
              <p className="mt-1 text-[11px] text-carbon-blue/45">
                No company linked — decisions save without account context; open from Company 360 to attach.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border border-carbon-blue/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/60"
          >
            Close
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
          <label className="block">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
              Raw text (meeting notes, email, transcript)
            </span>
            <textarea
              value={rawText}
              onChange={(event) => setRawText(event.target.value)}
              rows={10}
              placeholder={`Example:\nDecision: Approved feedstock trial with mixed plastics\nAction: Mats to send proposal by Friday\nRisk: Permit timeline may slip in Q3`}
              className="mt-1 w-full border border-carbon-blue/15 px-2 py-2 text-xs text-carbon-blue outline-none focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy !== null || !rawText.trim()}
              onClick={() => void handleExtract()}
              className="border border-upcycle-orange/30 bg-upcycle-orange/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-upcycle-orange disabled:opacity-50"
            >
              {busy === "extract" ? "Extracting…" : "Extract Signals"}
            </button>
            <button
              type="button"
              disabled={busy !== null || !signals}
              onClick={() => void handleSave()}
              className="border border-carbon-blue bg-carbon-blue px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white disabled:opacity-50"
            >
              {busy === "save" ? "Saving…" : "Save to Organizational Memory"}
            </button>
          </div>

          {error ? <p className="text-[11px] text-thermal-red">{error}</p> : null}
          {saveSummary ? <p className="text-[11px] text-emerald-700">{saveSummary}</p> : null}

          {signals ? (
            <div className="space-y-3 border border-carbon-blue/10 bg-carbon-blue/[0.02] p-3">
              <p className="text-[11px] text-carbon-blue/65">{signals.summary}</p>

              <SignalGroup
                title="Decisions Made"
                empty="No decisions detected"
                items={signals.decisions.map((d) => ({
                  title: d.decisionText,
                  meta: [d.category, d.stakeholderName, `conf ${(d.confidenceScore * 100).toFixed(0)}%`]
                    .filter(Boolean)
                    .join(" · "),
                }))}
              />
              <SignalGroup
                title="Commitments / Tasks"
                empty="No commitments detected"
                items={signals.commitments.map((c) => ({
                  title: c.title,
                  meta: [c.assignee, c.dueDate].filter(Boolean).join(" · "),
                }))}
              />
              <SignalGroup
                title="Risks & Objections"
                empty="No risks detected"
                items={signals.risks.map((r) => ({
                  title: r.description,
                  meta: `Severity: ${r.severity}`,
                }))}
              />
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function SignalGroup({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: Array<{ title: string; meta?: string }>;
}) {
  return (
    <div>
      <p className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
        {title}
      </p>
      {items.length === 0 ? (
        <p className="mt-1 text-[11px] text-carbon-blue/45">{empty}</p>
      ) : (
        <ul className="mt-1 space-y-1.5">
          {items.map((item) => (
            <li
              key={`${item.title}-${item.meta ?? ""}`}
              className="border border-carbon-blue/10 bg-white px-2 py-1.5"
            >
              <p className="text-xs text-carbon-blue">{item.title}</p>
              {item.meta ? (
                <p className="mt-0.5 text-[10px] text-carbon-blue/45">{item.meta}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
