import { Suspense } from "react";
import { TeamsAssignMessagePane } from "@/components/m365/teams-assign-message-pane";

export const dynamic = "force-dynamic";

export default function TeamsAssignMessagePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[100dvh] items-center justify-center bg-white px-6">
          <p className="text-[12px] text-carbon-blue/50">Loading…</p>
        </div>
      }
    >
      <TeamsAssignMessagePane />
    </Suspense>
  );
}
