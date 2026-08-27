"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AccountWorkspace } from "@/components/m365/account-workspace";
import { openOutlookSignInDialog } from "@/components/m365/outlook-auth-gate";
import type { M365AccountWorkspacePayload } from "@/types/m365";

type PaneState =
  | { status: "loading" }
  | { status: "ready"; payload: M365AccountWorkspacePayload; contextLabel?: string }
  | { status: "auth-required"; message: string }
  | { status: "empty"; message: string }
  | { status: "not-found"; message: string }
  | { status: "error"; message: string };

/**
 * FS-018 Phase 2 — Teams channel Account Workspace (max 7 blocks).
 * Bind via ?companyId= or ?projectId= (set by tab configuration).
 */
export function TeamsAccountWorkspacePane() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<PaneState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setState({ status: "loading" });
      const companyId = searchParams.get("companyId")?.trim() || "";
      const projectId = searchParams.get("projectId")?.trim() || "";
      const email = searchParams.get("email")?.trim().toLowerCase() || "";
      const teamId = searchParams.get("teamId")?.trim() || "";
      const channelId = searchParams.get("channelId")?.trim() || "";

      let resolvedCompanyId = companyId;
      let resolvedProjectId = projectId;

      if (!resolvedCompanyId && !resolvedProjectId && !email && teamId && channelId) {
        const bindRes = await fetch(
          `/api/teams/channel-binding?teamId=${encodeURIComponent(teamId)}&channelId=${encodeURIComponent(channelId)}`,
          { credentials: "include", cache: "no-store" },
        );
        if (bindRes.ok) {
          const body = (await bindRes.json()) as {
            binding?: { companyId?: string | null; projectId?: string | null };
          };
          resolvedCompanyId = body.binding?.companyId?.trim() || "";
          resolvedProjectId = body.binding?.projectId?.trim() || "";
        }
      }

      if (!resolvedCompanyId && !resolvedProjectId && !email) {
        if (!cancelled) {
          setState({
            status: "empty",
            message:
              "This channel tab is not bound yet. Reconfigure the SmartCRM tab and choose a company or project (e.g. Escalante).",
          });
        }
        return;
      }

      try {
        const params = new URLSearchParams();
        if (resolvedProjectId) params.set("projectId", resolvedProjectId);
        else if (resolvedCompanyId) params.set("companyId", resolvedCompanyId);
        else params.set("email", email);

        const response = await fetch(
          `/api/m365/account-workspace?${params.toString()}`,
          { credentials: "include", cache: "no-store" },
        );
        if (cancelled) return;

        if (response.status === 401 || response.status === 403) {
          setState({
            status: "auth-required",
            message: "Sign in to SmartCRM to see this account workspace.",
          });
          return;
        }
        if (response.status === 404) {
          setState({
            status: "not-found",
            message: "No matching company or project was found for this channel binding.",
          });
          return;
        }
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          setState({
            status: "error",
            message: body?.error ?? "Unable to load Account Workspace.",
          });
          return;
        }

        const payload = (await response.json()) as M365AccountWorkspacePayload & {
          contextLabel?: string;
        };
        if (payload.kind !== "account-workspace") {
          setState({ status: "error", message: "Unexpected intelligence payload." });
          return;
        }
        setState({
          status: "ready",
          payload,
          contextLabel: payload.contextLabel,
        });
      } catch {
        if (!cancelled) {
          setState({ status: "error", message: "Unable to load Account Workspace." });
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
        <p className="text-[12px] text-carbon-blue/50">Loading account workspace…</p>
      </div>
    );
  }

  if (state.status === "auth-required") {
    return (
      <div className="flex h-[100dvh] flex-col justify-center bg-white px-6">
        <div className="w-full max-w-sm border border-carbon-blue/10 bg-carbon-blue/[0.02] p-5">
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-upcycle-orange">
            SmartCRM · Account Workspace
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

  if (state.status === "empty" || state.status === "not-found" || state.status === "error") {
    return (
      <div className="flex h-[100dvh] flex-col justify-center bg-white px-6">
        <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-upcycle-orange">
          SmartCRM · Account Workspace
        </p>
        <p className="mt-2 text-sm font-semibold text-carbon-blue">
          {state.status === "empty"
            ? "Bind this channel"
            : state.status === "not-found"
              ? "Not found"
              : "SmartCRM unavailable"}
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-carbon-blue/50">{state.message}</p>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] overflow-auto bg-white">
      {state.contextLabel ? (
        <p className="border-b border-carbon-blue/8 px-5 py-2 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45">
          {state.contextLabel}
        </p>
      ) : null}
      <AccountWorkspace payload={state.payload} variant="teams" />
    </div>
  );
}
