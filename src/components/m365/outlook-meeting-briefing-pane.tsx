"use client";

import { MeetingBriefing } from "@/components/m365/meeting-briefing";
import { openOutlookSignInDialog } from "@/components/m365/outlook-auth-gate";
import { buildSmartCrmUrl } from "@/lib/m365/outlook-context";
import { useOutlookM365PaneLoad } from "@/hooks/use-outlook-m365-pane-load";
import type { M365MeetingBriefingPayload } from "@/types/m365";

export function OutlookMeetingBriefingPane() {
  const { state, resolvedEmail } = useOutlookM365PaneLoad<M365MeetingBriefingPayload>({
    apiPath: "/api/m365/meeting-briefing",
    expectedKind: "meeting-briefing",
    emptyMessage: "Open a meeting or email with a known contact to prepare your briefing.",
    errorMessage: "Unable to load meeting briefing.",
    unexpectedPayloadMessage: "Unexpected intelligence payload.",
  });

  if (state.status === "loading") {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-white px-6">
        <p className="text-[12px] text-carbon-blue/50">Preparing meeting briefing…</p>
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

  if (state.status === "auth-required") {
    return (
      <div className="flex h-[100dvh] flex-col justify-center bg-white px-6">
        <div className="w-full max-w-sm border border-carbon-blue/10 bg-carbon-blue/[0.02] p-5">
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-upcycle-orange">
            SmartCRM · Meeting Briefing
          </p>
          <p className="mt-2 text-sm font-semibold text-carbon-blue">Sign In to SmartCRM</p>
          <p className="mt-1 text-[11px] leading-relaxed text-carbon-blue/50">{state.message}</p>
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

  if (state.status === "not-found" && resolvedEmail) {
    return (
      <div className="flex h-[100dvh] flex-col justify-center bg-white px-6">
        <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-upcycle-orange">
          SmartCRM · Meeting Briefing
        </p>
        <p className="mt-2 text-sm font-semibold text-carbon-blue">Not ready to brief</p>
        <p className="mt-1 text-[11px] leading-relaxed text-carbon-blue/50">
          This contact is not currently in SmartCRM. Add them from the Relationship Card first.
        </p>
        {resolvedEmail ? (
          <p className="mt-3 text-[10px] text-carbon-blue/35">{resolvedEmail}</p>
        ) : null}
      </div>
    );
  }

  if (state.status === "empty") {
    return (
      <div className="flex h-[100dvh] flex-col justify-center bg-white px-6">
        <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-upcycle-orange">
          SmartCRM · Meeting Briefing
        </p>
        <p className="mt-2 text-sm font-semibold text-carbon-blue">Not ready to brief</p>
        <p className="mt-1 text-[11px] leading-relaxed text-carbon-blue/50">{state.message}</p>
        {resolvedEmail ? (
          <p className="mt-3 text-[10px] text-carbon-blue/35">{resolvedEmail}</p>
        ) : null}
        <a
          href={buildSmartCrmUrl("/companies")}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 text-[10px] font-semibold uppercase tracking-wider text-upcycle-orange hover:underline"
        >
          Open SmartCRM
        </a>
      </div>
    );
  }

  if (state.status === "ready") {
    return <MeetingBriefing payload={state.payload} variant="outlook" />;
  }

  return null;
}
