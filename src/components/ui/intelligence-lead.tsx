"use client";

import type { ReactNode } from "react";
import { LivingRecordStrip } from "@/components/ui/living-record-strip";

/**
 * Living workspace lead — answers immediately:
 * 1. What am I looking at?
 * 2. What matters?
 * 3. What should I do next?
 *
 * Michelin: one hero. Progressive disclosure: vitals are calm, not dashboards.
 */
export function IntelligenceLead({
  eyebrow,
  title,
  status,
  summary,
  vitals,
  action,
  className = "",
}: {
  eyebrow: string;
  title: string;
  status?: ReactNode;
  summary: string;
  vitals?: Array<{ label: string; value: string; highlight?: boolean }>;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`dashboard-card overflow-hidden ${className}`}>
      <div className="px-5 py-4 sm:px-6 sm:py-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/40">
          {eyebrow}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-carbon-blue sm:text-xl">{title}</h2>
          {status}
        </div>
        {vitals && vitals.length > 0 ? (
          <div className="mt-3">
            <LivingRecordStrip items={vitals} />
          </div>
        ) : null}
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-carbon-blue/60">{summary}</p>
      </div>
      {action ? (
        <div className="border-t border-carbon-blue/8 px-5 py-4 sm:px-6">{action}</div>
      ) : null}
    </section>
  );
}
