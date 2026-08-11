import { Suspense } from "react";
import {
  OutlookAddinErrorBoundary,
  OutlookAuthGate,
} from "@/components/m365/outlook-auth-gate";
import { OutlookRelationshipCardPane } from "@/components/m365/outlook-relationship-card-pane";

/**
 * Outlook add-in task pane entry (manifest SourceLocation).
 * Same Relationship Card surface as `/outlook/relationship-card`.
 * Unauthenticated users always reach the Sign In card (gate + error boundary).
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function OutlookAddinPage() {
  return (
    <OutlookAddinErrorBoundary>
      <OutlookAuthGate>
        <Suspense
          fallback={
            <div
              data-smartcrm-connecting=""
              className="flex h-[100dvh] items-center justify-center bg-white px-6"
            >
              <p className="text-[12px] text-carbon-blue/50">Loading relationship intelligence…</p>
            </div>
          }
        >
          <OutlookRelationshipCardPane />
        </Suspense>
      </OutlookAuthGate>
    </OutlookAddinErrorBoundary>
  );
}
