import { Suspense } from "react";
import { TeamsDailyFocusPane } from "@/components/m365/teams-daily-focus-pane";

export const dynamic = "force-dynamic";

export default function TeamsDailyFocusPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[100dvh] items-center justify-center bg-white px-6">
          <p className="text-[12px] text-carbon-blue/50">Loading today’s focus…</p>
        </div>
      }
    >
      <TeamsDailyFocusPane />
    </Suspense>
  );
}
