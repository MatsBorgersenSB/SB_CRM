import { Suspense } from "react";
import {
  OutlookAddinErrorBoundary,
  OutlookAuthGate,
} from "@/components/m365/outlook-auth-gate";
import { OutlookMeetingBriefingPane } from "@/components/m365/outlook-meeting-briefing-pane";

export default function OutlookMeetingBriefingPage() {
  return (
    <OutlookAddinErrorBoundary>
      <OutlookAuthGate>
        <Suspense
          fallback={
            <div className="flex h-[100dvh] items-center justify-center bg-white px-6">
              <p className="text-[12px] text-carbon-blue/50">Preparing meeting briefing…</p>
            </div>
          }
        >
          <OutlookMeetingBriefingPane />
        </Suspense>
      </OutlookAuthGate>
    </OutlookAddinErrorBoundary>
  );
}
