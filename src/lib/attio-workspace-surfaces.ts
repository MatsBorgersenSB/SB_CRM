/**
 * Attio-grade surface tokens for Opportunity Detail workspace.
 * Keep borders/shadows/radii consistent across header, tabs, and section cards.
 */

export const ATTIO_SURFACE =
  "rounded-lg border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950";

export const ATTIO_SURFACE_MUTED =
  "rounded-lg border border-slate-200/80 bg-slate-50/50 shadow-sm dark:border-slate-800 dark:bg-slate-900/50";

export const ATTIO_SURFACE_HEADER =
  "border-b border-slate-200/80 bg-slate-50/50 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900/50";

export const ATTIO_PILL =
  "inline-flex max-w-full items-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-[12px] text-slate-600 transition-colors hover:border-slate-200/80 hover:bg-slate-100 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800";

export const ATTIO_PILL_STATIC =
  "inline-flex max-w-full items-center gap-1.5 rounded-md border border-slate-200/60 bg-slate-50/80 px-2 py-1 text-[12px] text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300";

export const ATTIO_SEGMENT_TRACK =
  "inline-flex w-full max-w-full flex-wrap gap-0.5 rounded-lg border border-slate-200/80 bg-slate-50/80 p-0.5 dark:border-slate-800 dark:bg-slate-900/60 sm:flex-nowrap sm:overflow-x-auto";

export const ATTIO_SEGMENT_ITEM =
  "shrink-0 rounded-md px-3 py-1.5 text-[12px] font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/30";

export function attioSegmentItemClass(active: boolean): string {
  return `${ATTIO_SEGMENT_ITEM} ${
    active
      ? "bg-white font-semibold text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-50"
      : "text-slate-500 hover:bg-white/70 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-100"
  }`;
}

export const ATTIO_GROUP_ACTIONS =
  "opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100";

export const ATTIO_STATUS_DOT =
  "inline-block size-1.5 shrink-0 rounded-full bg-emerald-500";
