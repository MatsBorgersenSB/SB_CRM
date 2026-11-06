"use client";

import { useState } from "react";
import {
  type BriefRow,
  type DealBrief,
  type DealVerdictId,
  type KnowledgeState,
} from "@/lib/opportunity-deal-brief";
import { ATTIO_SURFACE } from "@/lib/attio-workspace-surfaces";
import { EDITORIAL_LABEL } from "@/lib/editorial-design-system";

const VERDICT_DOT: Record<DealVerdictId, string> = {
  at_risk: "bg-thermal-red",
  not_understood: "bg-slate-400",
  needs_attention: "bg-upcycle-orange",
  clear_path: "bg-emerald-500",
};

const STATE_LABEL: Record<KnowledgeState, string> = {
  confirmed: "Confirmed",
  assumed: "Assumed",
  unknown: "Not confirmed",
};

const STATE_STYLE: Record<KnowledgeState, string> = {
  confirmed: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  assumed: "border-upcycle-orange/30 bg-upcycle-orange/10 text-upcycle-orange",
  unknown: "border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

const CHECK_MARK: Record<KnowledgeState, string> = { confirmed: "✓", assumed: "…", unknown: "" };
const CHECK_SR: Record<KnowledgeState, string> = {
  confirmed: "secured",
  assumed: "in progress",
  unknown: "not started",
};
const CHECK_STYLE: Record<KnowledgeState, string> = {
  confirmed: "border-emerald-500 bg-emerald-500 text-white",
  assumed: "border-upcycle-orange/60 bg-upcycle-orange/10 text-upcycle-orange",
  unknown: "border-slate-300 bg-white text-transparent dark:border-slate-600 dark:bg-slate-900",
};

/**
 * FS-005A Deal Brief — verdict, three answers, one line of change.
 * Reasoning stays behind "Why"; nothing here shows scores or engine detail.
 */
export function OpportunityDealBriefHero({
  brief,
  onAnswerNow,
}: {
  brief: DealBrief;
  onAnswerNow?: (fieldId: string) => void;
}) {
  const { verdict } = brief;
  const development = Boolean(brief.want.checklist);
  return (
    <section aria-label="Deal brief" className={`${ATTIO_SURFACE} overflow-hidden`}>
      <div className="flex flex-col gap-1 border-b border-slate-200/80 px-4 py-4 sm:px-5 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <span
            className={`h-2.5 w-2.5 shrink-0 rounded-full ${VERDICT_DOT[verdict.id]}`}
            aria-hidden
          />
          <h2 className="text-[18px] font-semibold text-slate-900 dark:text-slate-50">
            {verdict.label}
          </h2>
        </div>
        <p className="text-[14px] leading-relaxed text-slate-600 dark:text-slate-300">
          {verdict.impact}
        </p>
      </div>

      <div className="grid divide-y divide-slate-200/80 lg:grid-cols-3 lg:divide-x lg:divide-y-0 dark:divide-slate-800">
        <BriefColumn label={brief.columns.want} row={brief.want} onAnswerNow={onAnswerNow} development={development} />
        <BriefColumn label={brief.columns.blocker} row={brief.blocker} onAnswerNow={onAnswerNow} development={development} />
        <BriefColumn label={brief.columns.next} row={brief.next} onAnswerNow={onAnswerNow} development={development} />
      </div>

      <p className="border-t border-slate-200/80 px-4 py-3 text-[13px] text-slate-500 sm:px-5 dark:border-slate-800 dark:text-slate-400">
        {brief.whatChanged}
      </p>
    </section>
  );
}

function BriefColumn({
  label,
  row,
  onAnswerNow,
  development = false,
}: {
  label: string;
  row: BriefRow;
  onAnswerNow?: (fieldId: string) => void;
  development?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-2 px-4 py-4 sm:px-5">
      <p className={EDITORIAL_LABEL}>{label}</p>
      {row.state ? (
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATE_STYLE[row.state]}`}
          >
            {development && row.state === "assumed" ? "In progress" : STATE_LABEL[row.state]}
          </span>
          {row.source ? (
            <span className="text-[12px] text-slate-500 dark:text-slate-400">{row.source}</span>
          ) : null}
        </div>
      ) : null}
      <p className="text-[15px] font-medium leading-snug text-slate-900 dark:text-slate-50">
        {row.headline}
      </p>
      {row.checklist ? (
        <ul aria-label="Development checklist" className="flex flex-col gap-0.5">
          {row.checklist.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                disabled={!item.fieldId || !onAnswerNow}
                onClick={() => item.fieldId && onAnswerNow?.(item.fieldId)}
                title={item.note ?? "Nothing recorded yet. Click to answer."}
                className="flex w-full items-start gap-2 rounded px-1 py-1 text-left text-[13px] leading-snug text-slate-700 transition-colors enabled:hover:bg-slate-100 dark:text-slate-200 dark:enabled:hover:bg-slate-800"
              >
                <span
                  aria-hidden
                  className={`mt-px inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[11px] font-bold ${CHECK_STYLE[item.state]}`}
                >
                  {CHECK_MARK[item.state]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={item.state === "confirmed" ? "text-slate-500 line-through decoration-slate-300" : "font-medium"}>
                    {item.label}
                  </span>
                  <span className="sr-only"> — {CHECK_SR[item.state]}</span>
                  {item.state === "assumed" ? (
                    <span className="ml-1.5 text-[12px] text-upcycle-orange">in progress</span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
        {row.impact}
      </p>
      <div className="mt-auto flex flex-wrap items-center gap-3 pt-1">
        {row.fieldId && onAnswerNow ? (
          <button
            type="button"
            onClick={() => onAnswerNow(row.fieldId!)}
            className="inline-flex rounded-md border border-upcycle-orange/30 bg-upcycle-orange/10 px-3 py-1.5 text-[12px] font-semibold text-upcycle-orange transition-colors hover:bg-upcycle-orange/15"
          >
            Answer now
          </button>
        ) : null}
        {row.why ? (
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className="text-[12px] font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          >
            {open ? "Hide why" : "Why"}
          </button>
        ) : null}
      </div>
      {open && row.why ? (
        <p className="text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">{row.why}</p>
      ) : null}
    </div>
  );
}
