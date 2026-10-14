"use client";

import { useState } from "react";
import type { SmartAssistResolution } from "@/lib/smartassist/omniOrchestrator";

type SmartAssistResolutionCardProps = {
  resolution: SmartAssistResolution;
  onDismiss: () => void;
};

function badge(resolution: SmartAssistResolution): { label: string; className: string } {
  if (resolution.dataFreshness === "FRESH") {
    return {
      label: "Ferske interne data",
      className: "bg-emerald-50 text-emerald-800",
    };
  }
  if (resolution.dataFreshness === "EXTERNAL_ONLY") {
    return {
      label: "Ingen interne treff – Ekstern sourcing",
      className: "bg-slate-100 text-slate-700",
    };
  }
  return {
    label: "⚠️ Utdaterte interne data (Krever revalidering)",
    className: "bg-orange-50 text-orange-800",
  };
}

function suggestionPayload(resolution: SmartAssistResolution): {
  suggestions: Array<{ name: string; region: string }>;
  targetDate?: string;
} {
  const payload = resolution.suggestedNextAction.payload;
  const raw = payload.suggestions;
  const suggestions = Array.isArray(raw)
    ? raw.flatMap((row) => {
        if (!row || typeof row !== "object") return [];
        const record = row as { name?: unknown; region?: unknown };
        const name = typeof record.name === "string" ? record.name.trim() : "";
        const region = typeof record.region === "string" ? record.region.trim() : "";
        return name ? [{ name, region }] : [];
      })
    : resolution.sourcingSuggestions.map((item) => ({
        name: item.name,
        region: item.region,
      }));
  const targetDate = typeof payload.targetDate === "string" ? payload.targetDate : undefined;
  return { suggestions, ...(targetDate ? { targetDate } : {}) };
}

export function SmartAssistResolutionCard({
  resolution,
  onDismiss,
}: SmartAssistResolutionCardProps) {
  const [phase, setPhase] = useState<"idle" | "pending" | "done" | "error">("idle");
  const [createdCount, setCreatedCount] = useState<number | null>(null);
  const pill = badge(resolution);
  const action = resolution.suggestedNextAction;

  async function runAction() {
    if (phase === "pending") return;

    if (action.type === "REVIEW_DOC") {
      const webUrl = action.payload.webUrl;
      if (typeof webUrl === "string" && webUrl) window.open(webUrl, "_blank", "noopener,noreferrer");
      setPhase("done");
      return;
    }

    if (action.type !== "CREATE_LEADS_AND_CALLS") {
      setPhase("done");
      return;
    }

    const body = suggestionPayload(resolution);
    setCreatedCount(body.suggestions.length);
    setPhase("pending");
    try {
      const response = await fetch("/api/smartassist/execute-sourcing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { success?: boolean; createdCount?: number };
      if (!response.ok || !payload.success) {
        setCreatedCount(null);
        setPhase("error");
        return;
      }
      setCreatedCount(payload.createdCount ?? 0);
      setPhase("done");
    } catch {
      setCreatedCount(null);
      setPhase("error");
    }
  }

  return (
    <section className="border border-border bg-white text-foreground">
      <header className="flex items-start justify-between gap-2 border-b border-border px-3 py-2">
        <p className="text-[11px] font-semibold tracking-wide">⚡ SMARTASSIST INNSIKT</p>
        <span className={`px-2 py-0.5 text-[10px] font-medium ${pill.className}`}>{pill.label}</span>
      </header>
      <div className="space-y-2 px-3 py-2 text-xs leading-relaxed">
        <p>{resolution.summary}</p>
        {resolution.temporalNote ? (
          <p className="text-muted-foreground">{resolution.temporalNote}</p>
        ) : null}
        {resolution.sourcingSuggestions.length > 0 ? (
          <ul className="space-y-1">
            {resolution.sourcingSuggestions.map((item) => (
              <li key={`${item.name}-${item.region}`}>
                <span className="font-medium">{item.name}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {item.category} · {item.region}. {item.reasoning}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        {phase === "done" && action.type === "CREATE_LEADS_AND_CALLS" ? (
          <p className="font-medium">Opprettet {createdCount ?? 0} leverandørlead.</p>
        ) : null}
        {phase === "done" && action.type === "DRAFT_REVALIDATION_EMAIL" ? (
          <p className="text-muted-foreground">
            {typeof action.payload.body === "string" ? action.payload.body : "Utkast er klart til gjennomgang."}
          </p>
        ) : null}
        {phase === "error" ? (
          <p className="text-orange-800">Lagringen feilet. Ingenting nytt ble beholdt.</p>
        ) : null}
      </div>
      <footer className="flex flex-wrap gap-2 border-t border-border px-3 py-2">
        <button
          type="button"
          onClick={() => void runAction()}
          disabled={phase === "pending" || phase === "done"}
          className="bg-foreground px-2.5 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
        >
          {phase === "pending" ? `Oppretter ${createdCount ?? 0}…` : `✓ ${action.label}`}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="border border-border bg-white px-2.5 py-1.5 text-[11px] text-muted-foreground"
        >
          ✕ Avvis
        </button>
      </footer>
    </section>
  );
}
