"use client";

import { useCallback, useMemo, useState } from "react";
import { ExplainabilityBlock } from "@/components/ui/explainability-block";
import { FilterTransparencyBar } from "@/components/ui/filter-transparency-bar";
import {
  ATTIO_GROUP_ACTIONS,
  ATTIO_PILL_STATIC,
  ATTIO_SEGMENT_TRACK,
  ATTIO_SURFACE,
  ATTIO_SURFACE_HEADER,
  ATTIO_SURFACE_MUTED,
  attioSegmentItemClass,
} from "@/lib/attio-workspace-surfaces";
import type { FilterSummaryChip } from "@/types/workspace-filters";
import {
  WORKFLOW_STATUS_FILTERS,
  WORKFLOW_TRIGGER_FILTERS,
  type WorkflowApprovalQueueData,
  type WorkflowExecutionView,
  type WorkflowStatusFilter,
  type WorkflowTriggerFilter,
} from "@/types/fs011-workflows";

function labelizeAction(actionType: string): string {
  return actionType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function labelizeTrigger(triggerType: string): string {
  const known = WORKFLOW_TRIGGER_FILTERS.find((entry) => entry.id === triggerType);
  return known?.label ?? triggerType.replace(/_/g, " ");
}

export function WorkflowApprovalWorkspace({
  initialData,
}: {
  initialData: WorkflowApprovalQueueData;
}) {
  const [data, setData] = useState(initialData);
  const [statusFilter, setStatusFilter] =
    useState<WorkflowStatusFilter>("pending_approval");
  const [triggerFilter, setTriggerFilter] = useState<WorkflowTriggerFilter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return data.executions.filter((execution) => {
      if (statusFilter !== "all" && execution.status !== statusFilter) return false;
      if (triggerFilter !== "all" && execution.triggerType !== triggerFilter) {
        return false;
      }
      return true;
    });
  }, [data.executions, statusFilter, triggerFilter]);

  const activeFilters = useMemo((): FilterSummaryChip[] => {
    const chips: FilterSummaryChip[] = [];
    if (statusFilter !== "all") {
      const meta = WORKFLOW_STATUS_FILTERS.find((entry) => entry.id === statusFilter);
      chips.push({
        id: "status",
        label: "Status",
        value: meta?.label ?? statusFilter,
        onRemove: () => setStatusFilter("all"),
      });
    }
    if (triggerFilter !== "all") {
      const meta = WORKFLOW_TRIGGER_FILTERS.find((entry) => entry.id === triggerFilter);
      chips.push({
        id: "trigger",
        label: "Trigger",
        value: meta?.label ?? triggerFilter,
        onRemove: () => setTriggerFilter("all"),
      });
    }
    return chips;
  }, [statusFilter, triggerFilter]);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/workflows/executions", { cache: "no-store" });
    if (!response.ok) return;
    const payload = (await response.json()) as WorkflowApprovalQueueData;
    setData(payload);
  }, []);

  const approve = async (executionId: string) => {
    setBusyId(executionId);
    setError(null);
    try {
      const response = await fetch(
        `/api/workflows/executions/${encodeURIComponent(executionId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "approve" }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        detail?: string;
      };
      if (!response.ok) {
        throw new Error(payload.detail || payload.error || "Approve failed");
      }
      await refresh();
    } catch (approveError) {
      setError(
        approveError instanceof Error ? approveError.message : "Approve failed",
      );
    } finally {
      setBusyId(null);
    }
  };

  const dismiss = async (executionId: string) => {
    setBusyId(executionId);
    setError(null);
    try {
      const response = await fetch(
        `/api/workflows/executions/${encodeURIComponent(executionId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "dismiss" }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        detail?: string;
      };
      if (!response.ok) {
        throw new Error(payload.detail || payload.error || "Dismiss failed");
      }
      await refresh();
    } catch (dismissError) {
      setError(
        dismissError instanceof Error ? dismissError.message : "Dismiss failed",
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section aria-label="Workflow approval queue" className="flex flex-col gap-4">
      <header className={`${ATTIO_SURFACE} overflow-hidden`}>
        <div className={ATTIO_SURFACE_HEADER}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
            FS-011 · Autonomous Workflow Engine
          </p>
          <h1 className="mt-0.5 text-[18px] font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Pending Action Approval Queue
          </h1>
          <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
            SmartAssist proposes; you approve. No CRM side effects until Approve &amp; Execute.
          </p>
        </div>

        <div className="grid gap-3 px-4 py-4 sm:grid-cols-3 sm:px-5">
          <MetricCard
            label="Pending Approvals"
            value={data.metrics.pendingApprovals}
            emphasize
          />
          <MetricCard label="Executed Today" value={data.metrics.executedToday} />
          <MetricCard
            label="Time Saved"
            value={`${data.metrics.timeSavedMinutes}m`}
            hint="Advisory estimate"
          />
        </div>
      </header>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[13px] font-semibold text-slate-900 dark:text-slate-50">
              Executions
            </h2>
            <p className="mt-0.5 text-[12px] text-slate-500">
              Filter by status and trigger type (AD-001).
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <div className={ATTIO_SEGMENT_TRACK} role="tablist" aria-label="Status filter">
              {WORKFLOW_STATUS_FILTERS.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  role="tab"
                  aria-selected={statusFilter === entry.id}
                  onClick={() => setStatusFilter(entry.id)}
                  className={attioSegmentItemClass(statusFilter === entry.id)}
                >
                  {entry.label}
                </button>
              ))}
            </div>
            <div className={ATTIO_SEGMENT_TRACK} role="tablist" aria-label="Trigger filter">
              {WORKFLOW_TRIGGER_FILTERS.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  role="tab"
                  aria-selected={triggerFilter === entry.id}
                  onClick={() => setTriggerFilter(entry.id)}
                  className={attioSegmentItemClass(triggerFilter === entry.id)}
                >
                  {entry.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <FilterTransparencyBar
          entityLabel="Executions"
          filteredCount={filtered.length}
          totalCount={data.executions.length}
          activeFilters={activeFilters}
          onClearAll={
            activeFilters.length >= 2
              ? () => {
                  setStatusFilter("pending_approval");
                  setTriggerFilter("all");
                }
              : undefined
          }
        />
      </div>

      {error ? (
        <p className="rounded-lg border border-thermal-red/25 bg-thermal-red/[0.06] px-3 py-2 text-[12px] text-thermal-red">
          {error}
        </p>
      ) : null}

      {filtered.length === 0 ? (
        <p className={`${ATTIO_SURFACE_MUTED} px-4 py-6 text-[13px] text-slate-500`}>
          No workflow executions match the active filters.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {filtered.map((execution) => (
            <li key={execution.id} className="group">
              <ExecutionCard
                execution={execution}
                busy={busyId === execution.id}
                onApprove={() => void approve(execution.id)}
                onDismiss={() => void dismiss(execution.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function MetricCard({
  label,
  value,
  emphasize = false,
  hint,
}: {
  label: string;
  value: number | string;
  emphasize?: boolean;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200/80 bg-slate-50/50 px-3 py-3 dark:border-slate-800 dark:bg-slate-900/50">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
        {label}
      </p>
      <p
        className={`mt-1 font-mono tabular-nums ${emphasize ? "text-[26px] font-semibold text-upcycle-orange" : "text-[22px] font-semibold text-slate-900 dark:text-slate-50"}`}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-[10px] text-slate-400">{hint}</p> : null}
    </div>
  );
}

function ExecutionCard({
  execution,
  busy,
  onApprove,
  onDismiss,
}: {
  execution: WorkflowExecutionView;
  busy: boolean;
  onApprove: () => void;
  onDismiss: () => void;
}) {
  const pending = execution.status === "pending_approval";

  return (
    <ExplainabilityBlock
      title={execution.title}
      observation={execution.observation}
      reasoning={execution.reasoning}
      recommendedAction={execution.recommendation}
      expectedOutcome={execution.expectedOutcome}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={ATTIO_PILL_STATIC}>{execution.status}</span>
            <span className={ATTIO_PILL_STATIC}>
              {labelizeAction(execution.actionType)}
            </span>
            <span className={ATTIO_PILL_STATIC}>
              {labelizeTrigger(execution.triggerType)}
            </span>
            {execution.companyName ? (
              <span className="text-[11px] text-slate-500">{execution.companyName}</span>
            ) : null}
            {execution.opportunityName ? (
              <span className="text-[11px] text-slate-400">
                · {execution.opportunityName}
              </span>
            ) : null}
          </div>

          {pending ? (
            <div className={`flex flex-wrap gap-2 ${ATTIO_GROUP_ACTIONS}`}>
              <button
                type="button"
                disabled={busy}
                onClick={onApprove}
                className="rounded-md border border-emerald-600 bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "Working…" : "Approve & Execute"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onDismiss}
                className="rounded-md border border-slate-200/80 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-500 hover:text-slate-800 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
              >
                Dismiss
              </button>
            </div>
          ) : (
            <span className="text-[11px] text-slate-400">
              {execution.executedAt
                ? `Executed ${new Date(execution.executedAt).toLocaleString()}`
                : execution.ruleName}
            </span>
          )}
        </div>
      }
    />
  );
}
