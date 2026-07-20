"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { DocumentSet360Snapshot } from "@/lib/document-set-engine";
import { DocumentSet360LivingWorkspace } from "@/components/smartdocs/document-set-360-living-workspace";

export function DocumentSet360Shell({ snapshot }: { snapshot: DocumentSet360Snapshot }) {
  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/knowledge"
        className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-carbon-blue/45 hover:text-upcycle-orange"
      >
        <ArrowLeft className="size-3.5" />
        SmartDocs
      </Link>

      <DocumentSet360LivingWorkspace snapshot={snapshot} />
    </div>
  );
}
