"use client";

import type { ReactNode } from "react";
import { ATTIO_SURFACE, ATTIO_SURFACE_HEADER } from "@/lib/attio-workspace-surfaces";

export type ExplainabilityParts = {
  /** What SmartAssist detected */
  observation: string;
  /** Why it matters commercially */
  reasoning: string;
  /** What step to take next */
  recommendedAction: string;
  /** The expected deal impact */
  expectedOutcome: string;
};

export type ExplainabilityBlockProps = ExplainabilityParts & {
  /** Optional eyebrow above the four parts */
  title?: string;
  /** Compact stacked layout for dense lists */
  compact?: boolean;
  className?: string;
  footer?: ReactNode;
};

const PARTS: Array<{
  key: keyof ExplainabilityParts;
  label: string;
  accent?: boolean;
}> = [
  {
    key: "observation",
    label: "What we see",
  },
  {
    key: "reasoning",
    label: "Why it matters",
  },
  {
    key: "recommendedAction",
    label: "What to do",
    accent: true,
  },
  {
    key: "expectedOutcome",
    label: "What it changes",
  },
];

/**
 * Standardized 4-part SmartAssist explanation.
 * AI proposes; users approve. Structure never auto-applies CRM changes.
 */
export function ExplainabilityBlock({
  observation,
  reasoning,
  recommendedAction,
  expectedOutcome,
  title,
  compact = false,
  className = "",
  footer,
}: ExplainabilityBlockProps) {
  const values: ExplainabilityParts = {
    observation,
    reasoning,
    recommendedAction,
    expectedOutcome,
  };

  return (
    <article
      className={`${ATTIO_SURFACE} overflow-hidden ${className}`}
      aria-label={title ?? "SmartAssist explainability"}
    >
      {title ? (
        <header className={ATTIO_SURFACE_HEADER}>
          <h3 className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
            {title}
          </h3>
        </header>
      ) : null}

      <dl
        className={
          compact
            ? "grid gap-3 px-3 py-3"
            : "grid gap-3 px-4 py-4 sm:grid-cols-2 sm:px-5"
        }
      >
        {PARTS.map((part) => {
          const value = values[part.key];
          const spanFull =
            !compact &&
            (part.key === "recommendedAction" || part.key === "expectedOutcome");
          return (
            <div key={part.key} className={`min-w-0 ${spanFull ? "sm:col-span-2" : ""}`}>
              <dt className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                {part.label}
              </dt>
              <dd
                className={`mt-1 text-[13px] leading-relaxed ${
                  part.accent
                    ? "font-medium text-upcycle-orange"
                    : "text-slate-700 dark:text-slate-200"
                }`}
              >
                {value}
              </dd>
            </div>
          );
        })}
      </dl>

      {footer ? (
        <div className="border-t border-slate-200/80 bg-slate-50/50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/50 sm:px-5">
          {footer}
        </div>
      ) : null}
    </article>
  );
}
