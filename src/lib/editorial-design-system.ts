/**
 * Editorial design system — calm, premium surfaces for Mission Control and SmartAssist.
 * Navigation uses `@/lib/workspace-mode-nav` (Browse | Create | Import pattern).
 */

import { workspaceModeNavButtonClass } from "@/lib/workspace-mode-nav";

/** Content width — prose/reading surfaces only; workspaces use WORKSPACE_SURFACE */
export const EDITORIAL_CONTENT = "max-w-2xl";

/** Vertical rhythm */
export const EDITORIAL_GAP_PAGE = "gap-12";
export const EDITORIAL_GAP_SECTION = "gap-10";
export const EDITORIAL_GAP_BLOCK = "gap-8";
export const EDITORIAL_GAP_LIST = "space-y-5";

/** Typography — sentence case, no shouting uppercase */
export const EDITORIAL_LABEL =
  "text-[11px] font-medium tracking-normal text-carbon-blue/45";
export const EDITORIAL_META = "text-[12px] text-carbon-blue/45";
export const EDITORIAL_BODY = "text-[14px] leading-relaxed text-carbon-blue/75";
export const EDITORIAL_BODY_MUTED = "text-[14px] leading-relaxed text-carbon-blue/55";
export const EDITORIAL_TITLE = "text-[16px] font-medium leading-snug text-carbon-blue";
export const EDITORIAL_ANSWER = "text-[16px] font-medium leading-snug text-carbon-blue";
export const EDITORIAL_HERO = "text-xl font-semibold tracking-tight text-carbon-blue";
export const EDITORIAL_PAGE_TITLE =
  "text-[1.625rem] font-semibold tracking-tight text-carbon-blue";
export const EDITORIAL_EMPTY = "text-[14px] leading-relaxed text-carbon-blue/45";

/** Surfaces and borders */
export const EDITORIAL_DIVIDER = "border-t border-carbon-blue/8";
export const EDITORIAL_BORDER_SUBTLE = "border-carbon-blue/8";
export const EDITORIAL_PANEL =
  "border border-carbon-blue/8 bg-[var(--dashboard-surface)] px-5 py-5 sm:px-6 sm:py-6";
export const EDITORIAL_PANEL_INSET = "bg-carbon-blue/[0.02] px-4 py-4 sm:px-5 sm:py-5";
export const EDITORIAL_ACCENT_BLOCK = "border-l-2 border-upcycle-orange/50 pl-4";

/** SmartAssist actions — use workspace mode nav for execution toggles */
export function editorialAssistButtonClass(active: boolean): string {
  return workspaceModeNavButtonClass(active);
}

export const EDITORIAL_TEXT_ACTION =
  "text-[12px] font-medium text-upcycle-orange transition-colors hover:text-upcycle-orange/80";

export const EDITORIAL_FIELD_LABEL = "text-[11px] font-medium text-carbon-blue/45";

/** Inputs */
export const EDITORIAL_INPUT =
  "w-full border border-carbon-blue/10 bg-carbon-blue/[0.02] px-4 py-3 text-[14px] text-carbon-blue outline-none transition-[border-color,background-color] placeholder:text-carbon-blue/35 focus:border-carbon-blue/20 focus:bg-[var(--dashboard-surface)]";

/** Mission insight hierarchy */
export const EDITORIAL_INSIGHT_PROMINENT = EDITORIAL_HERO;
export const EDITORIAL_INSIGHT_STANDARD = EDITORIAL_ANSWER;
