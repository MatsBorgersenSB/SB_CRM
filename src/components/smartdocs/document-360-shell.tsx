"use client";

import type { Document360Snapshot } from "@/lib/document-360-data";
import type { DocumentLocationTrail } from "@/lib/document-location";
import { Document360LivingWorkspace } from "@/components/smartdocs/document-360-living-workspace";
import { DocumentLocationTrailBar } from "@/components/smartdocs/document-location-trail";
import type { PipelineRow } from "@/types/pipeline";

export function Document360Shell({
  snapshot,
  trail,
  pipelines = [],
  onDocumentDelete,
}: {
  snapshot: Document360Snapshot;
  trail: DocumentLocationTrail;
  pipelines?: PipelineRow[];
  onDocumentDelete?: () => Promise<void>;
}) {
  return (
    <div className="flex flex-col gap-4">
      <DocumentLocationTrailBar trail={trail} />
      <Document360LivingWorkspace
        snapshot={snapshot}
        pipelines={pipelines}
        onDocumentDelete={onDocumentDelete}
      />
    </div>
  );
}
