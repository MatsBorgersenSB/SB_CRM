"use client";

import type { ReactNode } from "react";

/**
 * Calm loading state — shown instead of a blank screen while a workspace loads.
 * Answers "What am I looking at?" immediately (the label) and "Is it working?" (the pulse).
 */
export function WorkspaceLoading({ label = "Loading" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-6 text-center"
    >
      <span
        aria-hidden
        className="h-6 w-6 animate-spin rounded-full border-2 border-carbon-blue/15 border-t-upcycle-orange"
      />
      <p className="text-sm font-medium text-carbon-blue/70">{label}…</p>
    </div>
  );
}

/**
 * Plain-language notice for failures the user must know about.
 * Never fail silently: say what happened and what is still safe.
 */
export function WorkspaceNotice({
  children,
  tone = "error",
  onDismiss,
}: {
  children: ReactNode;
  tone?: "error" | "info";
  onDismiss?: () => void;
}) {
  const toneClass =
    tone === "error"
      ? "border-red-300/60 bg-red-50 text-red-900"
      : "border-carbon-blue/15 bg-carbon-blue/[0.04] text-carbon-blue";
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`mt-3 flex items-start justify-between gap-3 border px-3 py-2 text-[13px] leading-snug ${toneClass}`}
    >
      <span>{children}</span>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss message"
          className="shrink-0 text-xs font-semibold underline-offset-2 hover:underline"
        >
          Dismiss
        </button>
      ) : null}
    </div>
  );
}
