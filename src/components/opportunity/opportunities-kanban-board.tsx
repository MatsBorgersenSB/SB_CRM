"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { OpportunityOperationsRow } from "@/lib/opportunity-operations-data";
import { canMoveOpportunityStage } from "@/lib/permissions";
import {
  evaluateProjectConditions,
  projectConditionsApply,
  projectWonGateBlockers,
} from "@/lib/project-conditions";
import {
  classifyMove,
  columnFor,
  columnValue,
  moveRequiresReason,
  SALES_PIPELINES,
  SALES_PIPELINE_ORDER,
  salesPipelineFor,
  salesPipelineUnclassified,
  salesStageOf,
  stagePatch,
  type SalesPipelineId,
  type StageMove,
} from "@/lib/sales-pipelines";
import type { UserRole } from "@/types/auth";
import { formatDealValue, type PipelineRow, type SalesStageId } from "@/types/pipeline";

const ATTENTION_DOT = {
  HIGH: { dot: "bg-thermal-red", title: "Needs attention now" },
  MEDIUM: { dot: "bg-upcycle-orange", title: "Worth a look this week" },
  LOW: { dot: "bg-emerald-500", title: "On track" },
  HOLD: { dot: "bg-carbon-blue/30", title: "On hold" },
} as const;

type BlockerView = {
  id: string;
  label: string;
  missing: string[];
  whyItMatters: string;
  recommendedAction: string;
};

type BlockerPanel = { dealId: string; dealName: string; blockers: BlockerView[] };

type ReasonPrompt = {
  dealId: string;
  dealName: string;
  to: SalesStageId;
  move: StageMove;
  skipped: string[];
};

type Props = {
  rows: OpportunityOperationsRow[];
  deals: PipelineRow[];
  role: UserRole;
  pipelineId: SalesPipelineId;
  onPipelineChange: (id: SalesPipelineId) => void;
  /** Local, optimistic stage. `null` clears it (rollback). */
  onStageOverride: (dealId: string, stage: SalesStageId | null) => void;
};

function reasonCopy(prompt: ReasonPrompt, toLabel: string) {
  if (prompt.move.kind === "lost") {
    return {
      title: "Why was this deal lost?",
      hint: "A short reason helps the team learn what to do differently.",
    };
  }
  return {
    title: `Skip ahead to ${toLabel}?`,
    hint: `You are skipping ${prompt.skipped.join(" and ")}. Why is that safe?`,
  };
}

export function OpportunitiesKanbanBoard({
  rows,
  deals,
  role,
  pipelineId,
  onPipelineChange,
  onStageOverride,
}: Props) {
  const template = SALES_PIPELINES[pipelineId];
  const canMove = canMoveOpportunityStage(role);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<SalesStageId | null>(null);
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<BlockerPanel | null>(null);
  const [reasonPrompt, setReasonPrompt] = useState<ReasonPrompt | null>(null);
  const [reasonText, setReasonText] = useState("");
  const [announcement, setAnnouncement] = useState("");

  const dealById = useMemo(() => new Map(deals.map((d) => [d.id, d])), [deals]);
  const nameById = useMemo(() => new Map(rows.map((r) => [r.dealId, r.dealName])), [rows]);
  const nameOf = useCallback((id: string) => nameById.get(id) ?? "this deal", [nameById]);

  const pipelineCounts = useMemo(() => {
    const counts: Record<SalesPipelineId, number> = { "project-sales": 0, "offer-sales": 0 };
    for (const row of rows) {
      const deal = dealById.get(row.dealId);
      if (deal) counts[salesPipelineFor(deal)] += 1;
    }
    return counts;
  }, [rows, dealById]);

  const columns = useMemo(() => {
    const byStage = new Map<SalesStageId, Array<{ row: OpportunityOperationsRow; deal: PipelineRow }>>();
    for (const stage of template.stages) byStage.set(stage.id, []);
    for (const row of rows) {
      const deal = dealById.get(row.dealId);
      if (!deal || salesPipelineFor(deal) !== pipelineId) continue;
      const column = columnFor(template, salesStageOf(deal));
      if (column) byStage.get(column.id)?.push({ row, deal });
    }
    return template.stages.map((stage) => {
      const items = byStage.get(stage.id) ?? [];
      return { stage, items, value: columnValue(items.map((i) => i.deal)) };
    });
  }, [rows, dealById, template, pipelineId]);

  const conditionProgress = useMemo(() => {
    const progress = new Map<string, { confirmed: number; total: number }>();
    if (pipelineId !== "project-sales") return progress;
    for (const column of columns) {
      for (const { deal } of column.items) {
        if (!projectConditionsApply(deal)) continue;
        const states = evaluateProjectConditions(deal);
        progress.set(deal.id, {
          confirmed: states.filter((s) => s.status === "confirmed").length,
          total: states.length,
        });
      }
    }
    return progress;
  }, [columns, pipelineId]);

  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 6000);
  }, []);
  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    [],
  );

  const commit = useCallback(
    async (deal: PipelineRow, to: SalesStageId, reason?: string) => {
      const previous = salesStageOf(deal);
      onStageOverride(deal.id, to);
      setPending((current) => new Set(current).add(deal.id));
      const toLabel = columnFor(template, to)?.label ?? to;
      try {
        const response = await fetch(`/api/opportunities/${encodeURIComponent(deal.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...stagePatch(to), ...(reason ? { stageReason: reason } : {}) }),
        });
        if (!response.ok) {
          onStageOverride(deal.id, previous === to ? null : previous);
          const body = (await response.json().catch(() => null)) as {
            code?: string;
            error?: string;
            blockers?: BlockerView[];
          } | null;
          if (body?.code === "PROJECT_CONDITIONS_UNCONFIRMED" && body.blockers?.length) {
            setBlocked({ dealId: deal.id, dealName: nameOf(deal.id), blockers: body.blockers });
          } else {
            showNotice(body?.error ?? "The move did not save. The deal is back where it was.");
          }
          return;
        }
        setAnnouncement(`${nameOf(deal.id)} moved to ${toLabel}.`);
      } catch {
        onStageOverride(deal.id, previous === to ? null : previous);
        showNotice("Could not reach the server. The deal is back where it was.");
      } finally {
        setPending((current) => {
          const next = new Set(current);
          next.delete(deal.id);
          return next;
        });
      }
    },
    [nameOf, onStageOverride, showNotice, template],
  );

  const requestMove = useCallback(
    (dealId: string, to: SalesStageId) => {
      const deal = dealById.get(dealId);
      if (!deal || pending.has(dealId)) return;
      if (!canMove) {
        showNotice("Your role can view the pipeline but not move deals between stages.");
        return;
      }
      const from = salesStageOf(deal);
      const move = classifyMove(template, from, to);
      if (move.kind === "same") return;

      if (to === "won") {
        const blockers = projectWonGateBlockers(deal, stagePatch("won"));
        if (blockers.length > 0) {
          setBlocked({
            dealId,
            dealName: nameOf(dealId),
            blockers: blockers.map((b) => ({
              id: b.id,
              label: b.label,
              missing: b.missingLabels,
              whyItMatters: b.whyItMatters,
              recommendedAction: b.recommendedAction,
            })),
          });
          return;
        }
      }

      if (moveRequiresReason(move)) {
        const ordered = template.stages.filter((s) => s.kind !== "lost");
        const fromIndex = ordered.findIndex((s) => s.id === columnFor(template, from)?.id);
        const toIndex = ordered.findIndex((s) => s.id === to);
        const skipped =
          move.kind === "skip" ? ordered.slice(fromIndex + 1, toIndex).map((s) => s.label) : [];
        setReasonText("");
        setReasonPrompt({ dealId, dealName: nameOf(dealId), to, move, skipped });
        return;
      }

      void commit(deal, to);
    },
    [canMove, commit, dealById, nameOf, pending, showNotice, template],
  );

  const confirmReason = useCallback(() => {
    if (!reasonPrompt) return;
    const deal = dealById.get(reasonPrompt.dealId);
    const reason = reasonText.trim();
    if (!deal || reason.length < 3) return;
    setReasonPrompt(null);
    void commit(deal, reasonPrompt.to, reason);
  }, [commit, dealById, reasonPrompt, reasonText]);

  const handleCardKeyDown = useCallback(
    (event: React.KeyboardEvent, deal: PipelineRow) => {
      if (!event.shiftKey || (event.key !== "ArrowRight" && event.key !== "ArrowLeft")) return;
      event.preventDefault();
      const currentColumn = columnFor(template, salesStageOf(deal));
      const index = template.stages.findIndex((s) => s.id === currentColumn?.id);
      const target = template.stages[index + (event.key === "ArrowRight" ? 1 : -1)];
      if (target) requestMove(deal.id, target.id);
    },
    [requestMove, template],
  );

  const closeDialogs = useCallback(() => {
    setBlocked(null);
    setReasonPrompt(null);
  }, []);

  useEffect(() => {
    if (!blocked && !reasonPrompt) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDialogs();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [blocked, reasonPrompt, closeDialogs]);

  const reasonToLabel = reasonPrompt
    ? (template.stages.find((s) => s.id === reasonPrompt.to)?.label ?? reasonPrompt.to)
    : "";
  const reasonText_ = reasonPrompt ? reasonCopy(reasonPrompt, reasonToLabel) : null;
  const blockedHref = blocked ? rows.find((r) => r.dealId === blocked.dealId)?.dealHref : null;

  return (
    <div className="w-full">
      <div className="mb-3 flex flex-wrap items-center gap-2" role="tablist" aria-label="Sales pipeline">
        {SALES_PIPELINE_ORDER.map((id) => {
          const active = id === pipelineId;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onPipelineChange(id)}
              className={`rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors ${
                active
                  ? "border-carbon-blue bg-carbon-blue text-white"
                  : "border-carbon-blue/20 text-carbon-blue hover:border-carbon-blue/40"
              }`}
            >
              {SALES_PIPELINES[id].label}
              <span className={`ml-1.5 tabular-nums ${active ? "text-white/70" : "text-carbon-blue/55"}`}>
                {pipelineCounts[id]}
              </span>
            </button>
          );
        })}
        <span className="text-[13px] text-carbon-blue/65">{template.description}</span>
      </div>

      {notice ? (
        <p
          role="alert"
          className="mb-3 rounded-lg border border-thermal-red/30 bg-thermal-red/[0.05] px-3 py-2 text-[13px] text-carbon-blue"
        >
          {notice}
        </p>
      ) : null}

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      <div className="overflow-x-auto pb-2">
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(15rem, 1fr))` }}
        >
          {columns.map(({ stage, items, value }) => {
            const isOver = overStage === stage.id && draggingId !== null;
            return (
              <section
                key={stage.id}
                aria-label={`${stage.label}, ${items.length} deals`}
                onDragOver={(event) => {
                  if (!draggingId || !canMove) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  if (overStage !== stage.id) setOverStage(stage.id);
                }}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    setOverStage((current) => (current === stage.id ? null : current));
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const id = event.dataTransfer.getData("text/plain") || draggingId;
                  setOverStage(null);
                  setDraggingId(null);
                  if (id) requestMove(id, stage.id);
                }}
                className={`flex min-h-[12rem] flex-col rounded-xl border p-2 transition-colors ${
                  isOver
                    ? "border-upcycle-orange/60 bg-upcycle-orange/[0.06]"
                    : stage.kind === "won"
                      ? "border-emerald-500/25 bg-emerald-500/[0.03]"
                      : "border-carbon-blue/10 bg-carbon-blue/[0.02]"
                }`}
              >
                <header className="px-1 pb-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-[13px] font-semibold text-carbon-blue">{stage.label}</h3>
                    <span className="tabular-nums text-[13px] text-carbon-blue/65">{value.count}</span>
                  </div>
                  <p className="mt-0.5 text-[13px] tabular-nums text-carbon-blue/65">
                    {value.count === 0
                      ? "—"
                      : value.total === null || value.currency === null
                        ? "Value not fully known"
                        : formatDealValue(value.currency as PipelineRow["currency"], value.total)}
                  </p>
                </header>

                <ul className="flex flex-1 flex-col gap-2">
                  {items.map(({ row, deal }) => {
                    const attention = ATTENTION_DOT[row.recommendedAttention];
                    const progress = conditionProgress.get(deal.id);
                    const isPending = pending.has(deal.id);
                    const unclassified = salesPipelineUnclassified(deal);
                    return (
                      <li
                        key={deal.id}
                        draggable={canMove && !isPending}
                        tabIndex={0}
                        aria-keyshortcuts={canMove ? "Shift+ArrowLeft Shift+ArrowRight" : undefined}
                        onKeyDown={(event) => handleCardKeyDown(event, deal)}
                        onDragStart={(event) => {
                          event.dataTransfer.setData("text/plain", deal.id);
                          event.dataTransfer.effectAllowed = "move";
                          setDraggingId(deal.id);
                        }}
                        onDragEnd={() => {
                          setDraggingId(null);
                          setOverStage(null);
                        }}
                        className={`rounded-lg border border-carbon-blue/10 bg-white p-3 shadow-sm outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-upcycle-orange/60 ${
                          canMove ? "cursor-grab active:cursor-grabbing" : ""
                        } ${draggingId === deal.id ? "opacity-40" : ""} ${isPending ? "opacity-60" : ""}`}
                      >
                        <Link
                          href={row.dealHref}
                          draggable={false}
                          className="block text-[14px] font-semibold leading-snug text-carbon-blue hover:text-upcycle-orange"
                        >
                          {row.dealName}
                        </Link>
                        {row.companyName ? (
                          <p className="mt-0.5 truncate text-[13px] text-carbon-blue/65">
                            {row.companyName}
                          </p>
                        ) : null}

                        <div className="mt-2 flex items-start gap-2">
                          <span
                            className={`mt-[7px] size-2 shrink-0 rounded-full ${attention.dot}`}
                            title={attention.title}
                            aria-label={attention.title}
                            role="img"
                          />
                          <p className="line-clamp-2 text-[13px] leading-relaxed text-carbon-blue">
                            {row.biggestUnknown}
                          </p>
                        </div>

                        <div className="mt-2 flex items-center justify-between gap-2 text-[13px]">
                          <span className="tabular-nums font-semibold text-carbon-blue">
                            {row.valueLabel}
                          </span>
                          {progress && progress.total > 0 ? (
                            <span
                              className={`tabular-nums ${
                                progress.confirmed === progress.total
                                  ? "text-emerald-700"
                                  : "text-carbon-blue/65"
                              }`}
                              title="Project conditions confirmed. All are needed before Won."
                            >
                              {progress.confirmed}/{progress.total} conditions
                            </span>
                          ) : null}
                        </div>

                        {unclassified && pipelineId === "project-sales" ? (
                          <p className="mt-1 text-[13px] text-carbon-blue/65">Sales type not set</p>
                        ) : null}
                        <p className="mt-1 truncate text-[13px] text-carbon-blue/65">
                          {row.ownerLabel ?? "Unassigned"}
                        </p>
                      </li>
                    );
                  })}
                </ul>

                {items.length === 0 && draggingId ? (
                  <p className="px-1 pt-2 text-[13px] text-carbon-blue/55">Drop here</p>
                ) : null}
              </section>
            );
          })}
        </div>
      </div>

      {blocked ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-carbon-blue/40 p-4"
          onClick={closeDialogs}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="won-gate-title"
            onClick={(event) => event.stopPropagation()}
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
          >
            <h2 id="won-gate-title" className="text-lg font-semibold text-carbon-blue">
              Not ready to win {blocked.dealName}
            </h2>
            <p className="mt-1 text-[13px] text-carbon-blue/65">
              A project needs all eight conditions confirmed. {blocked.blockers.length} still{" "}
              {blocked.blockers.length === 1 ? "needs" : "need"} evidence.
            </p>
            <ul className="mt-4 space-y-3">
              {blocked.blockers.map((blocker) => (
                <li key={blocker.id} className="rounded-lg border border-carbon-blue/10 p-3">
                  <p className="text-[14px] font-semibold text-carbon-blue">{blocker.label}</p>
                  {blocker.missing.length > 0 ? (
                    <p className="mt-0.5 text-[13px] text-carbon-blue">
                      Missing: {blocker.missing.join(", ")}
                    </p>
                  ) : null}
                  <p className="mt-1 text-[13px] text-carbon-blue/65">{blocker.whyItMatters}</p>
                  <p className="mt-1 text-[13px] text-carbon-blue">
                    Next: {blocker.recommendedAction}
                  </p>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeDialogs}
                className="rounded-lg px-3 py-2 text-[13px] font-medium text-carbon-blue hover:bg-carbon-blue/5"
              >
                Close
              </button>
              {blockedHref ? (
                <Link
                  href={blockedHref}
                  className="rounded-lg bg-carbon-blue px-3 py-2 text-[13px] font-medium text-white hover:bg-carbon-blue/90"
                >
                  Open opportunity
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {reasonPrompt && reasonText_ ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-carbon-blue/40 p-4"
          onClick={closeDialogs}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="stage-reason-title"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              confirmReason();
            }}
            className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"
          >
            <h2 id="stage-reason-title" className="text-lg font-semibold text-carbon-blue">
              {reasonText_.title}
            </h2>
            <p className="mt-1 text-[13px] text-carbon-blue/65">
              {reasonPrompt.dealName}. {reasonText_.hint}
            </p>
            <label className="sr-only" htmlFor="stage-reason-input">
              Reason
            </label>
            <textarea
              id="stage-reason-input"
              autoFocus
              rows={3}
              maxLength={500}
              value={reasonText}
              onChange={(event) => setReasonText(event.target.value)}
              className="mt-3 w-full rounded-lg border border-carbon-blue/20 p-2 text-[14px] text-carbon-blue outline-none focus:border-upcycle-orange"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeDialogs}
                className="rounded-lg px-3 py-2 text-[13px] font-medium text-carbon-blue hover:bg-carbon-blue/5"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={reasonText.trim().length < 3}
                className="rounded-lg bg-carbon-blue px-3 py-2 text-[13px] font-medium text-white hover:bg-carbon-blue/90 disabled:opacity-40"
              >
                Move to {reasonToLabel}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
