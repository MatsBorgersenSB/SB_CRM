import type { ReactNode } from "react";
import {
  WORKSPACE_TABLE_BODY_CELL_CLASS,
  WORKSPACE_TABLE_BODY_ROW_CLASS,
  WORKSPACE_TABLE_CLASS,
  WORKSPACE_TABLE_HEAD_CELL_CLASS,
  WORKSPACE_TABLE_HEAD_ROW_CLASS,
} from "@/lib/workspace-design-system";

export function WorkspaceTable({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={`${WORKSPACE_TABLE_CLASS} ${className}`}>{children}</table>
    </div>
  );
}

export function WorkspaceTableHead({ children }: { children: ReactNode }) {
  return <thead>{children}</thead>;
}

export function WorkspaceTableHeadRow({ children }: { children: ReactNode }) {
  return <tr className={WORKSPACE_TABLE_HEAD_ROW_CLASS}>{children}</tr>;
}

export function WorkspaceTableHeadCell({
  children,
  className = "",
  align = "left",
  sortDirection,
  onSort,
}: {
  children: ReactNode;
  className?: string;
  align?: "left" | "right";
  /** Provide `onSort` to make the column sortable. `null` = sortable, not active. */
  sortDirection?: "asc" | "desc" | null;
  onSort?: () => void;
}) {
  const ariaSort =
    sortDirection === "asc" ? "ascending" : sortDirection === "desc" ? "descending" : undefined;
  return (
    <th
      aria-sort={onSort ? ariaSort ?? "none" : undefined}
      className={`${WORKSPACE_TABLE_HEAD_CELL_CLASS} ${
        align === "right" ? "text-right" : "text-left"
      } ${className}`}
    >
      {onSort ? (
        <button
          type="button"
          onClick={onSort}
          className={`inline-flex items-center gap-1 uppercase tracking-[inherit] hover:text-upcycle-orange focus-visible:outline focus-visible:outline-1 focus-visible:outline-upcycle-orange ${
            sortDirection ? "text-carbon-blue" : ""
          }`}
        >
          {children}
          <span aria-hidden className={sortDirection ? "" : "opacity-30"}>
            {sortDirection === "asc" ? "↑" : sortDirection === "desc" ? "↓" : "↕"}
          </span>
        </button>
      ) : (
        children
      )}
    </th>
  );
}

export function WorkspaceTableBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function WorkspaceTableBodyRow({
  children,
  className = "",
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <tr className={`${WORKSPACE_TABLE_BODY_ROW_CLASS} ${className}`} onClick={onClick}>
      {children}
    </tr>
  );
}

export function WorkspaceTableBodyCell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <td className={`${WORKSPACE_TABLE_BODY_CELL_CLASS} ${className}`}>{children}</td>;
}
