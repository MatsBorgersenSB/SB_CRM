"use client";

import Link from "next/link";
import type { DocumentLocationTrail } from "@/lib/document-location";

/** Sticky “where am I / back to Documents” strip — one line, Michelin. */
export function DocumentLocationTrailBar({
  trail,
}: {
  trail: DocumentLocationTrail;
}) {
  return (
    <nav
      aria-label="Document location"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-carbon-blue/8 bg-[var(--dashboard-surface)] px-4 py-2 text-[12px]"
    >
      <Link
        href={trail.href}
        className="font-semibold text-upcycle-orange hover:underline"
      >
        ← {trail.backLabel}
      </Link>
      <span className="text-carbon-blue/35" aria-hidden>
        ·
      </span>
      <span className="font-semibold uppercase tracking-wider text-carbon-blue/55">
        {trail.scopeLabel}
      </span>
      {trail.ownershipLabel ? (
        <>
          <span className="text-carbon-blue/35" aria-hidden>
            ·
          </span>
          <span className="text-carbon-blue/60">{trail.ownershipLabel}</span>
        </>
      ) : null}
    </nav>
  );
}
