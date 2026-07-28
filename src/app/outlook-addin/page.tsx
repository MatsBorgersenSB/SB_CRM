import { Suspense } from "react";
import { OutlookRelationshipCardPane } from "@/components/m365/outlook-relationship-card-pane";

/**
 * Outlook add-in task pane entry (manifest SourceLocation).
 * Same Relationship Card surface as `/outlook/relationship-card`.
 */
export default function OutlookAddinPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[100dvh] items-center justify-center bg-white px-6">
          <p className="text-[12px] text-carbon-blue/50">Loading relationship intelligence…</p>
        </div>
      }
    >
      <OutlookRelationshipCardPane />
    </Suspense>
  );
}
