/**
 * Workspace mode navigation — Browse | Create | Import pattern.
 * Single navigation language for mode switching across SmartCRM.
 */

export const WORKSPACE_MODE_NAV = "flex flex-wrap gap-2";

export function workspaceModeNavButtonClass(active: boolean): string {
  return `border px-3 py-1.5 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-upcycle-orange/20 ${
    active
      ? "border-upcycle-orange bg-upcycle-orange/10 text-upcycle-orange"
      : "border-carbon-blue/12 text-carbon-blue/60 hover:border-carbon-blue/25 hover:text-carbon-blue"
  }`;
}
