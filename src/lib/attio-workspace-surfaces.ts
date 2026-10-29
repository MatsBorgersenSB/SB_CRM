/**
 * Attio-grade surface tokens for Opportunity Detail workspace.
 * Keep borders/shadows/radii consistent across header, tabs, and section cards.
 */

export const ATTIO_SURFACE =
  "rounded-lg border border-carbon-blue/10 bg-card text-foreground";

export const ATTIO_SURFACE_MUTED =
  "rounded-lg border border-carbon-blue/10 bg-carbon-blue/[0.02] text-carbon-blue/75";

export const ATTIO_SURFACE_HEADER =
  "border-b border-carbon-blue/10 bg-carbon-blue/[0.02] px-4 py-2.5";

export const ATTIO_PILL =
  "inline-flex max-w-full items-center gap-1.5 rounded-md border border-transparent px-2.5 py-1 text-[13px] text-carbon-blue/75 transition-colors hover:border-carbon-blue/15 hover:bg-carbon-blue/[0.05] hover:text-carbon-blue";

export const ATTIO_PILL_STATIC =
  "inline-flex max-w-full items-center gap-1.5 rounded-md border border-carbon-blue/12 bg-carbon-blue/[0.03] px-2.5 py-1 text-[13px] text-carbon-blue/75";

export const ATTIO_SEGMENT_TRACK =
  "inline-flex w-full max-w-full flex-wrap gap-0.5 rounded-lg border border-carbon-blue/12 bg-carbon-blue/[0.03] p-0.5 sm:flex-nowrap sm:overflow-x-auto";

export const ATTIO_SEGMENT_ITEM =
  "shrink-0 rounded-md px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-upcycle-orange/30";

export function attioSegmentItemClass(active: boolean): string {
  return `${ATTIO_SEGMENT_ITEM} ${
    active
      ? "bg-card font-semibold text-carbon-blue shadow-xs"
      : "text-carbon-blue/70 hover:bg-card/70 hover:text-carbon-blue"
  }`;
}

export const ATTIO_GROUP_ACTIONS =
  "opacity-65 transition-opacity group-hover:opacity-100 focus-within:opacity-100";

export const ATTIO_STATUS_DOT =
  "inline-block size-1.5 shrink-0 rounded-full bg-emerald-500";
