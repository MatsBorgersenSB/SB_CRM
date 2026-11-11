"use client";

import type { DocumentSet360Snapshot } from "@/lib/document-set-engine";
import type { DocumentLocationTrail } from "@/lib/document-location";
import { DocumentSet360LivingWorkspace } from "@/components/smartdocs/document-set-360-living-workspace";
import { DocumentLocationTrailBar } from "@/components/smartdocs/document-location-trail";

export function DocumentSet360Shell({
  snapshot,
  trail,
}: {
  snapshot: DocumentSet360Snapshot;
  trail: DocumentLocationTrail;
}) {
  return (
    <div className="flex flex-col gap-4">
      <DocumentLocationTrailBar trail={trail} />
      <DocumentSet360LivingWorkspace snapshot={snapshot} />
    </div>
  );
}
