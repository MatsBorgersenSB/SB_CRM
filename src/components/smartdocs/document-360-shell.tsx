"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Document360Snapshot } from "@/lib/document-360-data";
import { Document360LivingWorkspace } from "@/components/smartdocs/document-360-living-workspace";

export function Document360Shell({ snapshot }: { snapshot: Document360Snapshot }) {
  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/knowledge"
        className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-carbon-blue/45 hover:text-upcycle-orange"
      >
        <ArrowLeft className="size-3.5" />
        SmartDocs
      </Link>

      <Document360LivingWorkspace snapshot={snapshot} />
    </div>
  );
}
