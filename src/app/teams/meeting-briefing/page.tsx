import { Suspense } from "react";
import { TeamsMeetingBriefingPane } from "@/components/m365/teams-meeting-briefing-pane";

export const dynamic = "force-dynamic";

export default function TeamsMeetingBriefingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[100dvh] items-center justify-center bg-white px-6">
          <p className="text-[12px] text-carbon-blue/50">Preparing meeting briefing…</p>
        </div>
      }
    >
      <TeamsMeetingBriefingPane />
    </Suspense>
  );
}
