"use client";

import { waitingOnCompanies } from "@/lib/query-pack";
import type { QueryPack } from "@/types/query-pack";

/**
 * 12-year-old test: one sentence + one big button. No “query pack” jargon.
 */
export function QueryPackStrip({
  pack,
  onOpen,
  contextLabel = "this project",
}: {
  pack: QueryPack | undefined;
  onOpen: () => void;
  /** e.g. "Antec - Hornindal" or "this deal" */
  contextLabel?: string;
}) {
  const waiting = pack ? waitingOnCompanies(pack) : [];
  const answeredCount =
    pack?.positions.filter((row) => row.status === "answered").length ?? 0;

  return (
    <section className="rounded-2xl border-2 border-upcycle-orange/40 bg-upcycle-orange/5 px-4 py-4 dark:border-upcycle-orange/30 dark:bg-upcycle-orange/10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-slate-900 dark:text-slate-50">
            Ask the companies
          </p>
          {pack ? (
            <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
              {waiting.length > 0
                ? `Waiting for answers from ${waiting.join(", ")}.`
                : answeredCount > 0
                  ? `${answeredCount} answer${answeredCount === 1 ? "" : "s"} brought back.`
                  : `Questions are ready for ${contextLabel}. Send the Excel, then bring answers back.`}
            </p>
          ) : (
            <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
              Write questions → send one Excel per company → bring their answers back here.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="shrink-0 rounded-xl bg-upcycle-orange px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-upcycle-orange/90"
        >
          {pack ? "Open questions" : "Start asking"}
        </button>
      </div>
    </section>
  );
}
