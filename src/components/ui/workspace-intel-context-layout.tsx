import type { ReactNode } from "react";
import {
  WORKSPACE_CONTEXT_COLUMN,
  WORKSPACE_INTEL_COLUMN,
  WORKSPACE_INTEL_CONTEXT_GRID,
} from "@/lib/workspace-design-system";

/**
 * Standard workspace layout — intelligence + actions left, context right.
 * Maximizes simultaneous visibility on modern displays.
 */
export function WorkspaceIntelContextLayout({
  header,
  intelligence,
  actions,
  context,
  footer,
}: {
  header?: ReactNode;
  intelligence: ReactNode;
  actions?: ReactNode;
  context: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <article>
      {header}

      <div className={`mt-6 ${WORKSPACE_INTEL_CONTEXT_GRID}`}>
        <div className={WORKSPACE_INTEL_COLUMN}>
          {intelligence}
          {actions}
        </div>
        <div className={WORKSPACE_CONTEXT_COLUMN}>{context}</div>
      </div>

      {footer}
    </article>
  );
}
