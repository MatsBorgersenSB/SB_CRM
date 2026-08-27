"use client";

import { useEffect, useState } from "react";
import { ensureTeamsSdk } from "@/lib/teams-sdk";

/**
 * FS-018 — Teams meeting tab configuration.
 * Auto-registers the Meeting Briefing content URL so admins don't pick CRM screens.
 */
export default function TeamsMeetingBriefingConfigPage() {
  const [status, setStatus] = useState("Preparing Meeting Briefing…");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const teams = await ensureTeamsSdk();
        const config = teams?.pages?.config;
        if (!teams || !config || cancelled) {
          setStatus("Open this page from a Teams meeting to add the briefing panel.");
          return;
        }
        await teams.app.initialize();
        const origin = window.location.origin;
        const contentUrl = `${origin}/teams/meeting-briefing`;
        config.registerOnSaveHandler((saveEvent) => {
          void config
            .setConfig({
              entityId: "smartcrm.meetingBriefing",
              contentUrl,
              websiteUrl: contentUrl,
              suggestedDisplayName: "Meeting Briefing",
            })
            .then(() => {
              saveEvent.notifySuccess();
            })
            .catch((err: unknown) => {
              saveEvent.notifyFailure(
                err instanceof Error ? err.message : "Could not save tab",
              );
            });
        });
        config.setValidityState(true);
        if (!cancelled) setStatus("Click Save to add Meeting Briefing to this meeting.");
      } catch {
        if (!cancelled) {
          setStatus("Could not initialize Teams. Try again from a meeting.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#faf9f8] p-6 text-center">
      <p className="text-sm font-semibold text-[#242424]">SmartCRM</p>
      <p className="mt-2 max-w-sm text-sm text-[#605e5c]">{status}</p>
    </main>
  );
}
