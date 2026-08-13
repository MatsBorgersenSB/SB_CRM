"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import { formatProbability } from "@/types/pipeline";
import {
  explainOpportunityWinProbability,
  formatWinProbabilityFactorImpact,
  type WinProbabilityFactor,
  type WinProbabilityExplanation,
} from "@/lib/opportunity-intelligence-engine";
import { ATTIO_PILL } from "@/lib/attio-workspace-surfaces";

function factorTone(factor: WinProbabilityFactor): string {
  if (factor.direction === "up") return "text-emerald-700 dark:text-emerald-400";
  if (factor.direction === "down") return "text-thermal-red";
  if (factor.direction === "base") return "text-slate-800 dark:text-slate-100";
  return "text-slate-500 dark:text-slate-400";
}

function ProbabilityExplanationPanel({
  explanation,
}: {
  explanation: WinProbabilityExplanation;
}) {
  const primaryFactors = explanation.factors.filter(
    (f) => f.direction === "base" || Math.abs(f.impactPoints) >= 0.5 || f.direction === "down",
  );

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
          What this is based on
        </p>
        <p className="mt-1 text-[13px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">
          {formatProbability(explanation.probability)} win likelihood
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-slate-600 dark:text-slate-300">
          {explanation.summary}
        </p>
        {explanation.recordedForecast != null ? (
          <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            Opportunity record also stores a forecast of{" "}
            <span className="font-medium tabular-nums text-slate-700 dark:text-slate-200">
              {formatProbability(explanation.recordedForecast)}
            </span>
            . The figure above is SmartCRM&apos;s assessed win likelihood from live signals.
          </p>
        ) : null}
      </div>

      <ul className="space-y-2">
        {primaryFactors.map((factor) => (
          <li
            key={factor.id}
            className="border border-slate-200/80 bg-slate-50/60 px-2.5 py-2 dark:border-slate-800 dark:bg-slate-900/50"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[12px] font-semibold text-slate-800 dark:text-slate-100">
                {factor.label}
              </p>
              <span
                className={`shrink-0 text-[11px] font-semibold tabular-nums ${factorTone(factor)}`}
              >
                {formatWinProbabilityFactorImpact(factor)}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              {factor.detail}
            </p>
          </li>
        ))}
      </ul>

      <details className="border border-slate-200/70 dark:border-slate-800">
        <summary className="cursor-pointer px-2.5 py-2 text-[11px] font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
          How SmartCRM calculates this
        </summary>
        <p className="border-t border-slate-200/70 px-2.5 py-2 text-[11px] leading-relaxed text-slate-500 dark:border-slate-800 dark:text-slate-400">
          Win probability starts from the typical rate for the current stage (
          {explanation.stageLabel}: {explanation.stageBaseline}%), then adjusts for account
          relationship health, deal momentum, stakeholder coverage, and any active risk signals.
          The result is clamped between 5% and 95%. Rule-based from known opportunity data — no AI.
        </p>
      </details>
    </div>
  );
}

/**
 * Key-info Probability control — click for progressive disclosure of win-likelihood basis.
 */
export function OpportunityProbabilityPill({
  pipeline,
  companies,
  activities,
  pipelines,
  popoverSide = "bottom",
}: {
  pipeline: PipelineRow;
  companies: Company[];
  activities: Activity[];
  pipelines: PipelineRow[];
  /** Prefer "top" inside overflow-clipped panels (e.g. Company Overview strips). */
  popoverSide?: "top" | "bottom";
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const explanation = useMemo(
    () =>
      explainOpportunityWinProbability(pipeline, companies, activities, pipelines),
    [pipeline, companies, activities, pipelines],
  );

  useEffect(() => {
    if (!open) return;

    const placePopover = () => {
      const anchor = rootRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const width = Math.min(22 * 16, window.innerWidth - 16);
      const left = Math.min(
        Math.max(8, rect.left),
        Math.max(8, window.innerWidth - width - 8),
      );
      const gap = 6;
      const top = popoverSide === "top" ? rect.top - gap : rect.bottom + gap;
      setCoords({ top, left });
    };

    placePopover();
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (dialogRef.current?.contains(target)) return;
      setOpen(false);
      setCoords(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setCoords(null);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", placePopover);
    window.addEventListener("scroll", placePopover, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", placePopover);
      window.removeEventListener("scroll", placePopover, true);
    };
  }, [open, popoverSide]);

  return (
    <div ref={rootRef} className={`relative ${ATTIO_PILL} group/pill`}>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
        Probability
      </dt>
      <dd className="min-w-0 font-medium text-slate-800 dark:text-slate-100">
        <button
          type="button"
          onClick={() =>
            setOpen((value) => {
              const next = !value;
              if (!next) setCoords(null);
              return next;
            })
          }
          aria-expanded={open}
          aria-haspopup="dialog"
          title="What this probability is based on"
          className="inline-flex items-center gap-1 tabular-nums text-upcycle-orange underline decoration-upcycle-orange/35 underline-offset-2 transition-colors hover:text-upcycle-orange/90 hover:decoration-upcycle-orange"
        >
          {formatProbability(explanation.probability)}
          <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 no-underline">
            why?
          </span>
        </button>
      </dd>

      {open && coords && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={dialogRef}
              role="dialog"
              aria-label="Probability explanation"
              className="w-[min(22rem,calc(100vw-2rem))] border border-slate-200/90 bg-white p-3 shadow-md dark:border-slate-700 dark:bg-slate-950"
              style={{
                position: "fixed",
                top: coords.top,
                left: coords.left,
                zIndex: 80,
                transform: popoverSide === "top" ? "translateY(-100%)" : undefined,
              }}
            >
              <ProbabilityExplanationPanel explanation={explanation} />
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
