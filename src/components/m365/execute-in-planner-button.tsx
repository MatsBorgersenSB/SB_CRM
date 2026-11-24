"use client";

import { useState } from "react";

type ExecuteInPlannerButtonProps = {
  title: string;
  body?: string;
  dueDate?: string | null;
  openUrl?: string | null;
  className?: string;
};

/**
 * FS-018 — create a To Do / Planner task via Graph, then open tasks.office.com.
 */
export function ExecuteInPlannerButton({
  title,
  body,
  dueDate,
  openUrl,
  className,
}: ExecuteInPlannerButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/m365/planner-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, dueDate, openUrl }),
      });
      const payload = (await response.json().catch(() => null)) as {
        webUrl?: string;
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Could not create Planner task");
      }
      const href = payload?.webUrl?.trim() || "https://tasks.office.com/";
      window.open(href, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create Planner task");
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <button
        type="button"
        disabled={busy || !title.trim()}
        onClick={() => void run()}
        className={
          className ??
          "text-[12px] font-semibold text-upcycle-orange hover:underline disabled:opacity-50"
        }
      >
        {busy ? "Creating…" : "Execute in Planner"}
      </button>
      {error ? <span className="text-[10px] text-thermal-red">{error}</span> : null}
    </span>
  );
}
