"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MeetingBriefing } from "@/components/m365/meeting-briefing";
import { openOutlookSignInDialog } from "@/components/m365/outlook-auth-gate";
import { resolveTeamsUserHint } from "@/lib/teams-sdk";
import type { M365MeetingBriefingPayload } from "@/types/m365";

type PaneState =
  | { status: "loading" }
  | { status: "ready"; payload: M365MeetingBriefingPayload }
  | { status: "auth-required"; message: string }
  | { status: "empty"; message: string }
  | { status: "not-found"; email: string }
  | { status: "error"; message: string };

/**
 * FS-018 Phase 1 — Teams meeting side panel Meeting Briefing.
 * Resolve counterparty via ?email= / ?companyId= (sideload / deep link),
 * with optional Teams context hint for future attendee wiring.
 */
export function TeamsMeetingBriefingPane() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<PaneState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setState({ status: "loading" });
      const emailParam = searchParams.get("email")?.trim().toLowerCase() || "";
      const companyId = searchParams.get("companyId")?.trim() || "";
      const teamsHint = emailParam ? null : await resolveTeamsUserHint();

      // Briefing needs the *counterparty*, not the signed-in user.
      // Until meeting attendees are wired, require email or companyId query.
      const email = emailParam;
      if (!email && !companyId) {
        if (!cancelled) {
          setState({
            status: "empty",
            message:
              teamsHint
                ? "Open this briefing with a contact email (?email=) or company (?companyId=), or use Outlook Meeting Briefing on the calendar item."
                : "Add ?email= or ?companyId= to prepare a briefing, or open from a calendar item in Outlook.",
          });
        }
        return;
      }

      try {
        const params = new URLSearchParams();
        if (companyId) params.set("companyId", companyId);
        else params.set("email", email);

        const response = await fetch(
          `/api/m365/meeting-briefing?${params.toString()}`,
          { credentials: "include", cache: "no-store" },
        );
        if (cancelled) return;

        if (response.status === 401 || response.status === 403) {
          setState({
            status: "auth-required",
            message: "Sign in to SmartCRM to prepare this meeting.",
          });
          return;
        }
        if (response.status === 404) {
          setState({ status: "not-found", email: email || companyId });
          return;
        }
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          setState({
            status: "error",
            message: body?.error ?? "Unable to load meeting briefing.",
          });
          return;
        }

        const payload = (await response.json()) as M365MeetingBriefingPayload;
        if (payload.kind !== "meeting-briefing") {
          setState({ status: "error", message: "Unexpected intelligence payload." });
          return;
        }
        setState({ status: "ready", payload });
      } catch {
        if (!cancelled) {
          setState({ status: "error", message: "Unable to load meeting briefing." });
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
        <p className="text-[12px] text-carbon-blue/50">Preparing meeting briefing…</p>
      </div>
    );
  }

  if (state.status === "auth-required") {
    return (
      <div className="flex h-[100dvh] flex-col justify-center bg-white px-6">
        <div className="w-full max-w-sm border border-carbon-blue/10 bg-carbon-blue/[0.02] p-5">
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-upcycle-orange">
            SmartCRM · Meeting Briefing
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

  if (state.status === "empty") {
    return (
      <div className="flex h-[100dvh] flex-col justify-center bg-white px-6">
        <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-upcycle-orange">
          SmartCRM · Meeting Briefing
        </p>
        <p className="mt-2 text-sm font-semibold text-carbon-blue">Choose who you are meeting</p>
        <p className="mt-1 text-[11px] leading-relaxed text-carbon-blue/50">{state.message}</p>
      </div>
    );
  }

  if (state.status === "not-found") {
    return (
      <div className="flex h-[100dvh] flex-col justify-center bg-white px-6">
        <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-upcycle-orange">
          SmartCRM · Meeting Briefing
        </p>
        <p className="mt-2 text-sm font-semibold text-carbon-blue">Not ready to brief</p>
        <p className="mt-1 text-[11px] leading-relaxed text-carbon-blue/50">
          This contact is not in SmartCRM yet. Add them via Relationship Intake first.
        </p>
        <p className="mt-3 text-[10px] text-carbon-blue/35">{state.email}</p>
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

  return (
    <div className="min-h-[100dvh] overflow-auto bg-white">
      <MeetingBriefing payload={state.payload} variant="outlook" />
    </div>
  );
}
