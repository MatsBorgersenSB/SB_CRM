"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import {
  WORKSPACE_ARCHITECT_QUICK_ACTIONS,
  type WorkspaceArchitectExecuteResult,
} from "@/lib/assistant/workspace-architect-types";
import { stashWorkspaceFilters } from "@/lib/workspace-filter-bridge";

type WorkspaceArchitectBarProps = {
  open: boolean;
  onClose: () => void;
};

export function WorkspaceArchitectBar({ open, onClose }: WorkspaceArchitectBarProps) {
  const router = useRouter();
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [commandText, setCommandText] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] =
    useState<WorkspaceArchitectExecuteResult | null>(null);

  useEffect(() => {
    if (!open) return;
    setFeedback(null);
    setError(null);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const applyResult = useCallback(
    (result: WorkspaceArchitectExecuteResult) => {
      setLastResult(result);
      setFeedback(result.result?.message ?? result.command.humanReadableConfirmation);

      if (result.command.filterIntent) {
        stashWorkspaceFilters(result.command.filterIntent);
      }

      const href = result.result?.href ?? result.command.href;
      if (href && result.executed !== false) {
        router.push(href);
        onClose();
      }
    },
    [onClose, router],
  );

  const runCommand = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        setError("Enter a command to continue.");
        return;
      }
      setLoading(true);
      setError(null);
      setFeedback(null);
      try {
        const response = await fetch("/api/assistant/architect/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            commandText: trimmed,
            context: {
              userId: user.id,
              role: user.role,
              displayName: user.displayName,
            },
          }),
        });
        const body = (await response.json()) as WorkspaceArchitectExecuteResult & {
          error?: string;
        };
        if (!response.ok) {
          setError(body.error ?? "Command failed");
          return;
        }
        applyResult(body);
      } catch {
        setError("Workspace Architect unavailable");
      } finally {
        setLoading(false);
      }
    },
    [applyResult, user.displayName, user.id, user.role],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-start justify-center px-4 pt-[12vh]">
      <button
        type="button"
        aria-label="Close architect"
        className="absolute inset-0 bg-carbon-blue/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Workspace Architect"
        className="command-palette relative z-[111] w-full max-w-2xl border border-carbon-blue/15 bg-[var(--dashboard-surface)] shadow-2xl"
      >
        <div className="border-b border-carbon-blue/8 px-4 py-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            Conversational Workspace Architect
          </p>
          <p className="text-[13px] font-semibold text-carbon-blue">
            Tell SmartAssist what to show or create
          </p>
        </div>

        <form
          className="flex items-center gap-2 border-b border-carbon-blue/8 px-4 py-3"
          onSubmit={(event) => {
            event.preventDefault();
            void runCommand(commandText);
          }}
        >
          <input
            ref={inputRef}
            value={commandText}
            onChange={(event) => setCommandText(event.target.value)}
            placeholder='e.g. “Show high-value opportunities in Norway”'
            className="min-w-0 flex-1 bg-transparent text-[14px] text-carbon-blue outline-none placeholder:text-carbon-blue/35"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading}
            className="shrink-0 border border-upcycle-orange/30 bg-upcycle-orange/10 px-3 py-1.5 text-[11px] font-semibold text-upcycle-orange hover:bg-upcycle-orange/15 disabled:opacity-50"
          >
            {loading ? "Running…" : "Execute"}
          </button>
        </form>

        <div className="px-4 py-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            Quick actions
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {WORKSPACE_ARCHITECT_QUICK_ACTIONS.map((action) => (
              <button
                key={action.id}
                type="button"
                disabled={loading}
                onClick={() => {
                  setCommandText(action.commandText);
                  void runCommand(action.commandText);
                }}
                className="border border-carbon-blue/15 bg-carbon-blue/[0.03] px-2.5 py-1 text-[11px] font-semibold text-carbon-blue/75 hover:border-carbon-blue/25 disabled:opacity-50"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>

        {(feedback || error || lastResult) && (
          <div className="border-t border-carbon-blue/8 px-4 py-3">
            {error ? (
              <p className="text-[11px] text-thermal-red">{error}</p>
            ) : null}
            {feedback ? (
              <p className="text-[12px] leading-relaxed text-carbon-blue/80">
                {feedback}
              </p>
            ) : null}
            {lastResult?.command.action !== "UNKNOWN" ? (
              <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                {lastResult?.command.action}
                {lastResult?.command.targetEntity
                  ? ` · ${lastResult.command.targetEntity}`
                  : ""}
                {lastResult?.executed ? " · Executed" : ""}
              </p>
            ) : null}
          </div>
        )}

        <div className="border-t border-carbon-blue/8 px-4 py-2 text-[10px] text-carbon-blue/40">
          Tip:{" "}
          <kbd className="font-mono text-carbon-blue/55">Ctrl+Shift+K</kbd>{" "}
          opens Architect ·{" "}
          <kbd className="font-mono text-carbon-blue/55">Esc</kbd> closes
        </div>
      </div>
    </div>
  );
}
