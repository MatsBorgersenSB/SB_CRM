/**
 * Unified workspace design system (Phase 5F).
 * Shared layout, section headers, and table styling across business objects.
 *
 * Editorial surfaces (Mission Control, SmartAssist) use `@/lib/editorial-design-system`.
 * Mode navigation (Browse | Create | Import) uses `@/lib/workspace-mode-nav`.
 */

/** Vertical stack spacing for living workspaces */
export const WORKSPACE_STACK_CLASS = "flex flex-col gap-6 xl:gap-8";

/**
 * Workspace utilization — intelligence + context side-by-side.
 * Wider breakpoints allocate more horizontal space to simultaneous visibility.
 */
export const WORKSPACE_SURFACE = "w-full";

/** Primary grid: intelligence/actions left, context right (~65/35 → ~60/40 on xl) */
export const WORKSPACE_INTEL_CONTEXT_GRID =
  "grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] lg:items-start xl:gap-8 2xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]";

export const WORKSPACE_INTEL_COLUMN = "min-w-0 space-y-5";

export const WORKSPACE_CONTEXT_COLUMN =
  "min-w-0 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto";

/** Metric cells below a workspace hero (why / block / outcome) */
export const WORKSPACE_INTEL_METRICS_GRID =
  "grid gap-5 sm:grid-cols-2 xl:grid-cols-3";

/** Context blocks — single column on laptop, two columns on very wide displays */
export const WORKSPACE_CONTEXT_BLOCKS_GRID = "grid gap-4 2xl:grid-cols-2";

export const WORKSPACE_PANEL_SURFACE =
  "rounded-lg border border-carbon-blue/8 bg-white px-5 py-5";

export const WORKSPACE_PANEL_HEADER_WRAPPER =
  "shrink-0 border-b-2 border-carbon-blue/10 bg-carbon-blue/[0.02] px-6 py-4";

export const WORKSPACE_PANEL_HEADER_CLASS =
  "flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.18em] text-carbon-blue sm:text-[13px]";

export const WORKSPACE_PANEL_BODY_CLASS = "min-h-0 flex-1 overflow-auto px-6 py-5";

/** Smooth expand/collapse for collapsible workspace panels */
export const WORKSPACE_PANEL_COLLAPSE_WRAPPER =
  "grid transition-[grid-template-rows] duration-200 ease-in-out";

export const WORKSPACE_PANEL_COLLAPSE_EXPANDED = "grid-rows-[1fr]";

export const WORKSPACE_PANEL_COLLAPSE_COLLAPSED = "grid-rows-[0fr]";

export const WORKSPACE_PANEL_COLLAPSE_INNER = "min-h-0 overflow-hidden";

export const WORKSPACE_TABLE_CLASS = "w-full table-fixed border-collapse text-left";

export const WORKSPACE_TABLE_HEAD_ROW_CLASS =
  "border-b-2 border-carbon-blue/10 bg-carbon-blue/[0.05]";

export const WORKSPACE_TABLE_HEAD_CELL_CLASS =
  "px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-carbon-blue/75";

export const WORKSPACE_TABLE_BODY_ROW_CLASS =
  "border-b border-carbon-blue/10 last:border-b-0 transition-colors hover:bg-carbon-blue/[0.03]";

export const WORKSPACE_TABLE_BODY_CELL_CLASS = "px-3 py-3 text-[12px] text-carbon-blue/80";
