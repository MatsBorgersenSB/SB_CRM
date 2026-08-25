"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { Calendar, Check, X, Zap } from "lucide-react";
import { formatDueDate } from "@/lib/activity-utils";
import {
  isDueDateOverdue,
  type PendingCommitmentView,
} from "@/lib/complete-commitment";
import {
  completeCommitmentInPlace,
  dismissCommitmentInView,
  isCommitmentDismissed,
  subscribeCommitmentDismissals,
} from "@/lib/complete-commitment-client";

function dueInputValue(dueDate: string): string {
  return dueDate.slice(0, 10);
}

export type CompleteCommitmentCardProps = {
  commitment: PendingCommitmentView;
  density?: "default" | "outlook";
  className?: string;
  onCompleted?: () => void;
  onRescheduled?: (nextActionDate: string) => void;
  onDismissed?: () => void;
};

/**
 * AI prepares the commitment; the user decides in place.
 * Michelin: one card, one overdue/open NextAction, no engine chrome.
 */
export function CompleteCommitmentCard({
  commitment,
  density = "default",
  className = "",
  onCompleted,
  onRescheduled,
  onDismissed,
}: CompleteCommitmentCardProps) {
  const dateRef = useRef<HTMLInputElement>(null);
  const dismissed = useSyncExternalStore(
    subscribeCommitmentDismissals,
    () => isCommitmentDismissed(commitment.activityId),
    () => false,
  );
  const [completed, setCompleted] = useState(false);
  const [note, setNote] = useState("");
  const [rescheduledDate, setRescheduledDate] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [busy, setBusy] = useState<"complete" | "reschedule" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const outlook = density === "outlook";
  const dueDate = rescheduledDate ?? commitment.dueDate;
  const overdue = rescheduledDate
    ? isDueDateOverdue(rescheduledDate)
    : commitment.overdue;
  const dueLabel = dueDate ? formatDueDate(dueDate) : "No due date";

  const handleComplete = async () => {
    setError(null);
    setCompleted(true);
    setBusy("complete");
    try {
      await completeCommitmentInPlace({
        activityId: commitment.activityId,
        outcomeNote: note.trim() || undefined,
        mode: "complete",
      });
      dismissCommitmentInView(commitment.activityId);
      onCompleted?.();
    } catch (err) {
      setCompleted(false);
      setError(err instanceof Error ? err.message : "Could not complete this commitment.");
    } finally {
      setBusy(null);
    }
  };

  const handleReschedule = async (nextActionDate: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextActionDate)) return;
    setError(null);
    setBusy("reschedule");
    const previous = rescheduledDate;
    setRescheduledDate(nextActionDate);
    try {
      await completeCommitmentInPlace({
        activityId: commitment.activityId,
        outcomeNote: note.trim() || undefined,
        mode: "reschedule",
        nextActionDate,
      });
      setShowDatePicker(false);
      onRescheduled?.(nextActionDate);
    } catch (err) {
      setRescheduledDate(previous);
      setError(err instanceof Error ? err.message : "Could not reschedule this commitment.");
    } finally {
      setBusy(null);
    }
  };

  const handleDismiss = () => {
    dismissCommitmentInView(commitment.activityId);
    onDismissed?.();
  };

  const openDatePicker = () => {
    setShowDatePicker(true);
    window.requestAnimationFrame(() => {
      const input = dateRef.current;
      if (!input) return;
      if (typeof input.showPicker === "function") {
        try {
          input.showPicker();
        } catch {
          input.focus();
        }
        return;
      }
      input.focus();
    });
  };

  if (dismissed || completed) return null;

  return (
    <section
      aria-label="Pending commitment"
      className={`border border-carbon-blue/10 bg-white ${outlook ? "px-2.5 py-2" : "px-3 py-2.5"} ${className}`.trim()}
    >
      <div className="flex items-center gap-1.5">
        <Zap
          className={`size-3 shrink-0 ${overdue ? "text-thermal-red" : "text-upcycle-orange"}`}
          strokeWidth={2}
          aria-hidden
        />
        <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-carbon-blue/45">
          Pending commitment
        </p>
      </div>

      <p
        className={`mt-1 font-semibold leading-snug text-carbon-blue ${outlook ? "text-[12px]" : "text-[13px]"}`}
      >
        {commitment.title}
      </p>

      <p
        className={`mt-0.5 text-[11px] ${overdue ? "font-semibold text-thermal-red" : "text-carbon-blue/50"}`}
      >
        {overdue ? `Overdue · ${dueLabel || "No due date"}` : dueLabel || "No due date"}
      </p>

      <label className="mt-2 block">
        <span className="sr-only">Outcome or note</span>
        <input
          type="text"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          disabled={busy !== null}
          placeholder="Outcome / note (optional)"
          className="w-full border border-carbon-blue/15 bg-white px-2 py-1 text-[12px] text-carbon-blue outline-none placeholder:text-carbon-blue/35 focus:border-upcycle-orange disabled:opacity-60"
        />
      </label>

      <div className={`mt-2 flex flex-wrap items-center ${outlook ? "gap-1.5" : "gap-2"}`}>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void handleComplete()}
          className="inline-flex items-center gap-1 border border-upcycle-orange bg-upcycle-orange px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Check className="size-3" strokeWidth={2.25} aria-hidden />
          {busy === "complete" ? "Saving…" : "Mark completed"}
        </button>

        <button
          type="button"
          disabled={busy !== null}
          onClick={openDatePicker}
          className="inline-flex items-center gap-1 border border-carbon-blue/20 bg-white px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/70 transition-colors hover:border-carbon-blue/35 hover:text-carbon-blue disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Calendar className="size-3" strokeWidth={2} aria-hidden />
          {busy === "reschedule" ? "Saving…" : "Reschedule"}
        </button>

        {showDatePicker ? (
          <input
            ref={dateRef}
            type="date"
            value={dueInputValue(dueDate)}
            disabled={busy !== null}
            onChange={(event) => {
              const value = event.target.value;
              if (value) void handleReschedule(value);
            }}
            className="border border-carbon-blue/15 bg-white px-1.5 py-1 text-[11px] text-carbon-blue outline-none focus:border-upcycle-orange disabled:opacity-60"
            aria-label="New due date"
          />
        ) : null}

        <button
          type="button"
          disabled={busy !== null}
          onClick={handleDismiss}
          className="inline-flex items-center gap-1 px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45 transition-colors hover:text-carbon-blue disabled:cursor-not-allowed disabled:opacity-60"
        >
          <X className="size-3" strokeWidth={2} aria-hidden />
          Dismiss
        </button>
      </div>

      {error ? <p className="mt-1.5 text-[11px] text-thermal-red">{error}</p> : null}
    </section>
  );
}
