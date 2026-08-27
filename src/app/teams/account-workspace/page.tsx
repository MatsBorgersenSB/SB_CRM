import { Suspense } from "react";
import { TeamsAccountWorkspacePane } from "@/components/m365/teams-account-workspace-pane";

export const dynamic = "force-dynamic";

export default function TeamsAccountWorkspacePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[100dvh] items-center justify-center bg-white px-6">
          <p className="text-[12px] text-carbon-blue/50">Loading account workspace…</p>
        </div>
      }
    >
      <TeamsAccountWorkspacePane />
    </Suspense>
  );
}
