"use client";

import { useMemo, useState } from "react";
import {
  type BriefRow,
  type DealBrief,
  type DealVerdictId,
  type KnowledgeState,
} from "@/lib/opportunity-deal-brief";
import {
  buildPillarExecutionDraft,
  type PillarCounterpartyBinding,
} from "@/lib/development-pillars";
import {
  formatArchetypeLabel,
  type FelMassEnergyEvaluation,
} from "@/lib/fel-mass-energy-engine";
import type { UnderstandingFieldId } from "@/types/opportunity-understanding";
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
  projectName,
  pillarCounterparties,
  felEvaluation,
  onAnswerNow,
  onScanFelRadar,
  scanningFelRadar = false,
  scanNotice = null,
}: {
  brief: DealBrief;
  projectName?: string;
  pillarCounterparties?: Partial<Record<UnderstandingFieldId, PillarCounterpartyBinding>>;
  felEvaluation?: FelMassEnergyEvaluation | null;
  onAnswerNow?: (fieldId: string) => void;
  onScanFelRadar?: () => void;
  scanningFelRadar?: boolean;
  scanNotice?: string | null;
}) {
  const { verdict } = brief;
  const development = Boolean(brief.want.checklist);
  const nextFieldId = (brief.next.fieldId ?? brief.blocker.fieldId) as
    | UnderstandingFieldId
    | undefined;
  const nextCounterparty = nextFieldId ? pillarCounterparties?.[nextFieldId] : undefined;
  const nextDraft = useMemo(() => {
    if (!development || !nextFieldId) return null;
    return buildPillarExecutionDraft({
      projectName: projectName || "Project",
      fieldId: nextFieldId,
      binding: nextCounterparty,
    });
  }, [development, nextFieldId, projectName, nextCounterparty]);

  return (
    <section aria-label="Deal brief" className={`${ATTIO_SURFACE} overflow-hidden`}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200/80 px-4 py-4 sm:px-5 dark:border-slate-800">
        <div className="flex flex-col gap-1">
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
        {onScanFelRadar ? (
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              disabled={scanningFelRadar}
              onClick={onScanFelRadar}
              className="inline-flex shrink-0 items-center rounded-md border border-upcycle-orange/40 bg-upcycle-orange/[0.08] px-3 py-1.5 text-[12px] font-semibold text-upcycle-orange transition-colors hover:bg-upcycle-orange/15 disabled:opacity-50"
            >
              {scanningFelRadar
                ? "Scanning documents, mail & FEL registries…"
                : "Scan documents, mail & FEL radar"}
            </button>
            {scanNotice ? (
              <span className="text-[11px] font-medium text-emerald-700">{scanNotice}</span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="grid divide-y divide-slate-200/80 lg:grid-cols-3 lg:divide-x lg:divide-y-0 dark:divide-slate-800">
        <BriefColumn
          label={brief.columns.want}
          row={brief.want}
          onAnswerNow={onAnswerNow}
          development={development}
          pillarCounterparties={pillarCounterparties}
        />
        <BriefColumn
          label={brief.columns.blocker}
          row={brief.blocker}
          onAnswerNow={onAnswerNow}
          development={development}
          pillarCounterparties={pillarCounterparties}
        />
        <BriefColumn
          label={brief.columns.next}
          row={brief.next}
          onAnswerNow={onAnswerNow}
          development={development}
          pillarCounterparties={pillarCounterparties}
          outlookDraftHref={nextDraft?.outlookWebHref}
          outlookDraftLabel={
            nextCounterparty?.companyName
              ? `Email ${nextCounterparty.companyName} in Outlook`
              : "Prepare email in Outlook"
          }
        />
      </div>

      {development && felEvaluation ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 bg-slate-50/70 px-4 py-2.5 text-[12px] text-slate-700 sm:px-5 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-300">
          <div>
            <span className="font-semibold uppercase tracking-wider text-slate-500">
              FEL 1 Mass &amp; Energy ({formatArchetypeLabel(felEvaluation.ready ? felEvaluation.input.archetype : felEvaluation.archetype)}):
            </span>{" "}
            {felEvaluation.ready ? (
              <span>
                <span className="font-semibold">
                  {felEvaluation.input.wetTonnesRangeLabel ??
                    `${felEvaluation.input.wetTonnesPerYear.toLocaleString("en-US")} t/yr`}
                </span>{" "}
                → <span className="font-semibold">{felEvaluation.reactorLines} line{felEvaluation.reactorLines === 1 ? "" : "s"}</span>{" "}
                · <span className="font-semibold text-emerald-700">~{felEvaluation.netExportThermalGwhPerYear} GWh/yr</span> net heat{" "}
                · <span className="font-semibold">~{felEvaluation.biocharTonnesPerYear.toLocaleString("en-US")} t/yr</span> biochar (~{felEvaluation.corcTonnesCo2ePerYear.toLocaleString("en-US")} CORCs)
              </span>
            ) : (
              <span className="text-slate-500">
                Feedstock volume (t/yr) not confirmed yet — open Pillar 2 to calculate GWh/yr heat, biochar &amp; CORCs.
              </span>
            )}
          </div>
          {onAnswerNow ? (
            <button
              type="button"
              onClick={() => onAnswerNow("feedstock_agreement")}
              className="shrink-0 font-semibold text-upcycle-orange hover:underline"
            >
              {felEvaluation.ready ? "Open FEL 1 calculator →" : "Enter feedstock t/yr →"}
            </button>
          ) : null}
        </div>
      ) : null}

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
  pillarCounterparties,
  outlookDraftHref,
  outlookDraftLabel,
}: {
  label: string;
  row: BriefRow;
  onAnswerNow?: (fieldId: string) => void;
  development?: boolean;
  pillarCounterparties?: Partial<Record<UnderstandingFieldId, PillarCounterpartyBinding>>;
  outlookDraftHref?: string;
  outlookDraftLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const boundParty =
    row.fieldId && pillarCounterparties
      ? pillarCounterparties[row.fieldId as UnderstandingFieldId]
      : undefined;

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
      {!row.checklist && boundParty?.companyName ? (
        <p className="text-[12px] text-slate-600 dark:text-slate-300">
          Counterparty: <span className="font-semibold">{boundParty.companyName}</span>
          {boundParty.stakeholderName ? ` · ${boundParty.stakeholderName}` : ""}
        </p>
      ) : null}
      {row.checklist ? (
        <ul aria-label="Development checklist" className="flex flex-col gap-0.5">
          {row.checklist.map((item) => {
            const cp =
              item.fieldId && pillarCounterparties
                ? pillarCounterparties[item.fieldId as UnderstandingFieldId]
                : undefined;
            return (
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
                    <span
                      className={
                        item.state === "confirmed"
                          ? "text-slate-500 line-through decoration-slate-300"
                          : "font-medium"
                      }
                    >
                      {item.label}
                    </span>
                    {cp?.companyName ? (
                      <span className="ml-1.5 text-[11px] font-normal text-slate-500">
                        · {cp.companyName}
                      </span>
                    ) : null}
                    <span className="sr-only"> — {CHECK_SR[item.state]}</span>
                    {item.state === "assumed" ? (
                      <span className="ml-1.5 text-[12px] text-upcycle-orange">in progress</span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      <p className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
        {row.impact}
      </p>
      <div className="mt-auto flex flex-wrap items-center gap-2.5 pt-1">
        {row.fieldId && onAnswerNow ? (
          <button
            type="button"
            onClick={() => onAnswerNow(row.fieldId!)}
            className="inline-flex rounded-md border border-upcycle-orange/30 bg-upcycle-orange/10 px-3 py-1.5 text-[12px] font-semibold text-upcycle-orange transition-colors hover:bg-upcycle-orange/15"
          >
            Answer now
          </button>
        ) : null}
        {outlookDraftHref ? (
          <a
            href={outlookDraftHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            {outlookDraftLabel ?? "Prepare email in Outlook"}
          </a>
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
