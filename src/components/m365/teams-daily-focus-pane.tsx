"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DailyFocus } from "@/components/m365/daily-focus";
import { openOutlookSignInDialog } from "@/components/m365/outlook-auth-gate";
import type { M365DailyFocusPayload } from "@/types/m365";

type PaneState =
  | { status: "loading" }
  | { status: "ready"; payload: M365DailyFocusPayload }
  | { status: "auth-required"; message: string }
  | { status: "error"; message: string };

/**
 * FS-018 Phase 1 — Teams personal app Daily Focus (exactly 4 blocks).
 */
export function TeamsDailyFocusPane() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<PaneState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setState({ status: "loading" });
      try {
        const response = await fetch("/api/m365/daily-focus", {
          credentials: "include",
          cache: "no-store",
        });
        if (cancelled) return;
        if (response.status === 401 || response.status === 403) {
          setState({
            status: "auth-required",
            message: "Sign in to SmartCRM to see today’s focus.",
          });
          return;
        }
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          setState({
            status: "error",
            message: body?.error ?? "Unable to load Daily Focus.",
          });
          return;
        }
        const payload = (await response.json()) as M365DailyFocusPayload;
        if (payload.kind !== "daily-focus") {
          setState({ status: "error", message: "Unexpected intelligence payload." });
          return;
        }
        setState({ status: "ready", payload });
      } catch {
        if (!cancelled) {
          setState({ status: "error", message: "Unable to load Daily Focus." });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  if (state.status === "loading") {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-white px-6">
        <p className="text-[12px] text-carbon-blue/50">Loading today’s focus…</p>
      </div>
    );
  }

  if (state.status === "auth-required") {
    return (
      <div className="flex h-[100dvh] flex-col justify-center bg-white px-6">
        <div className="w-full max-w-sm border border-carbon-blue/10 bg-carbon-blue/[0.02] p-5">
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-upcycle-orange">
            SmartCRM · Teams
          </p>
          <p className="mt-2 text-sm font-semibold text-carbon-blue">Sign In to SmartCRM</p>
          <p className="mt-1 text-[11px] leading-relaxed text-carbon-blue/50">
            {state.message}
          </p>
          <button
            type="button"
            onClick={() =>
              void openOutlookSignInDialog(() => {
                window.location.reload();
              })
            }
            className="mt-5 inline-flex w-full items-center justify-center border border-upcycle-orange bg-upcycle-orange px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-white"
          >
            Sign In to SmartCRM
          </button>
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex h-[100dvh] flex-col justify-center bg-white px-6">
        <p className="text-sm font-semibold text-carbon-blue">SmartCRM unavailable</p>
        <p className="mt-1 text-[11px] text-carbon-blue/50">{state.message}</p>
      </div>
    );
  }

  return <DailyFocus payload={state.payload} variant="teams" />;
}
