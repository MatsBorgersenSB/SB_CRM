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
  return <table className={`${WORKSPACE_TABLE_CLASS} ${className}`}>{children}</table>;
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
}: {
  children: ReactNode;
  className?: string;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`${WORKSPACE_TABLE_HEAD_CELL_CLASS} ${
        align === "right" ? "text-right" : "text-left"
      } ${className}`}
    >
      {children}
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
