import { Suspense } from "react";
import {
  OutlookAddinErrorBoundary,
  OutlookAuthGate,
} from "@/components/m365/outlook-auth-gate";
import { OutlookAddinModeRouter } from "@/components/m365/outlook-addin-mode-router";

/**
 * Outlook add-in task pane entry (manifest SourceLocation).
 * Read → Relationship Card. Compose (?mode=compose) → Assign pane.
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
              <p className="text-[12px] text-carbon-blue/50">Loading SmartCRM…</p>
            </div>
          }
        >
          <OutlookAddinModeRouter />
        </Suspense>
      </OutlookAuthGate>
    </OutlookAddinErrorBoundary>
  );
}
