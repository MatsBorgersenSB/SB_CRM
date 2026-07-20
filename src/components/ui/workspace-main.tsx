import type { ReactNode } from "react";
import { WORKSPACE_STACK_CLASS } from "@/lib/workspace-design-system";

/**
 * Full-width workspace content area — uses available width after sidebar.
 * Desktop-first: no narrow centered max-width containers.
 */
export function WorkspaceMain({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <main className="flex-1 overflow-auto">
      <div className={`w-full px-4 py-4 sm:px-6 sm:py-6 xl:px-8 xl:py-7 ${className}`}>
        {children}
      </div>
    </main>
  );
}

/** Standard vertical section stack for living workspaces */
export function WorkspaceStack({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`${WORKSPACE_STACK_CLASS} ${className}`}>{children}</div>;
}
