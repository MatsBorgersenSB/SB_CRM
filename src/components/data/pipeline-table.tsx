"use client";

import { useCallback, useRef, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useAuth } from "@/context/auth-context";
import { EditableCell } from "@/components/ui/editable-cell";
import { StaticCell } from "@/components/ui/static-cell";
import { StatusBadge } from "@/components/ui/status-badge";
import { useCellKeyboard } from "@/hooks/use-cell-keyboard";
import { canWritePipelineColumn } from "@/lib/permissions";
import { syncPipelineField, type SyncState } from "@/lib/sync-pipeline";
import type {
  CompanyRole,
  EditablePipelineField,
  PipelineRow,
  PipelineStatus,
} from "@/types/pipeline";
import {
  buildSharePointPatch,
  COLUMN_KEYS,
  formatProbability,
  getEditableCellDisplayValue,
  getEditableCellValue,
  PIPELINE_STATUSES,
} from "@/types/pipeline";

type StatusVariant = "active" | "success" | "pending" | "error";

const statusVariant: Record<PipelineStatus, StatusVariant> = {
  Prospecting: "pending",
  "Feedstock Analysis": "pending",
  "Contract Negotiation": "pending",
  Won: "success",
  "Reactor Manufacturing": "active",
  "Site Installation": "active",
  "Commissioning Phase": "active",
  "Live Production": "success",
  "Scheduled Maintenance": "error",
};

const columnHelper = createColumnHelper<PipelineRow>();

const tableColumns = [
  columnHelper.accessor("id", {
    id: "system-id",
    header: "System ID",
    size: 80,
  }),
  columnHelper.accessor("assetName", {
    id: "asset-name",
    header: "Client / Asset",
    size: 156,
  }),
  columnHelper.accessor("companyRole", {
    id: "enterprise-role",
    header: "Enterprise Role",
    size: 132,
  }),
  columnHelper.accessor("reactorDesignCapacity", {
    id: "design-capacity",
    header: "Design Capacity",
    size: 104,
  }),
  columnHelper.accessor("salesValue", {
    id: "deal-value",
    header: "Deal Value",
    size: 112,
  }),
  columnHelper.accessor("probability", {
    id: "probability-forecast",
    header: "Probability Forecast",
    size: 112,
  }),
  columnHelper.accessor("status", {
    id: "current-phase-gate",
    header: "Current Phase-Gate",
    size: 136,
  }),
];

type PipelineTableProps = {
  data: PipelineRow[];
  onDataChange: (data: PipelineRow[]) => void;
  onSelect: (row: PipelineRow) => void;
  onRowUpdate?: (row: PipelineRow) => void;
  navigationPaused?: boolean;
};

function EnterpriseRoleBadge({ role }: { role: CompanyRole }) {
  return (
    <span className="inline-flex items-center border border-carbon-blue/20 bg-carbon-blue/[0.04] px-1.5 py-0.5 text-[9px] font-semibold text-carbon-blue/75">
      {role}
    </span>
  );
}

function PhaseGateBadge({ status }: { status: PipelineStatus }) {
  return <StatusBadge label={status} variant={statusVariant[status]} />;
}

function PhaseGateSelect({
  status,
  focused,
  onCommit,
  onCancel,
}: {
  status: PipelineStatus;
  focused: boolean;
  onCommit: (value: string) => void;
  onCancel: () => void;
}) {
  return (
    <select
      autoFocus
      defaultValue={status}
      className="w-full border border-upcycle-orange bg-white px-1 py-0 text-[10px] text-carbon-blue outline-none"
      onBlur={(event) => onCommit(event.target.value)}
      onChange={(event) => onCommit(event.target.value)}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
      }}
    >
      {PIPELINE_STATUSES.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function ProbabilityBadge({
  probability,
  editing,
  focused,
  readOnly,
  onStartEdit,
  onCommit,
  onCancel,
}: {
  probability: number;
  editing: boolean;
  focused: boolean;
  readOnly: boolean;
  onStartEdit: () => void;
  onCommit: (value: string) => void;
  onCancel: () => void;
}) {
  if (readOnly) {
    return (
      <StaticCell
        value={formatProbability(probability)}
        mono
        badge
        focused={focused}
      />
    );
  }

  if (editing) {
    return (
      <EditableCell
        value={String(probability)}
        editing
        focused={focused}
        mono
        onStartEdit={onStartEdit}
        onCommit={onCommit}
        onCancel={onCancel}
      />
    );
  }

  return (
    <button
      type="button"
      onDoubleClick={onStartEdit}
      className={`inline-flex min-w-[40px] items-center justify-center border border-carbon-blue/20 bg-carbon-blue/[0.04] px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums text-carbon-blue/75 ${
        focused ? "ring-1 ring-upcycle-orange/40 ring-inset" : ""
      }`}
    >
      {formatProbability(probability)}
    </button>
  );
}

function SyncDot({ state }: { state: SyncState }) {
  if (state === "idle") {
    return <span className="block size-1.5" />;
  }

  const styles: Record<Exclude<SyncState, "idle">, string> = {
    syncing: "bg-upcycle-orange animate-pulse",
    synced: "bg-upcycle-orange/70",
    error: "bg-thermal-red",
  };

  return (
    <span
      className={`block size-1.5 rounded-full ${styles[state]}`}
      title={state}
    />
  );
}

export function PipelineTable({
  data,
  onDataChange,
  onSelect,
  onRowUpdate,
  navigationPaused = false,
}: PipelineTableProps) {
  const { user } = useAuth();
  const [focus, setFocus] = useState({ row: 0, col: 1 });
  const [editing, setEditing] = useState<{ row: number; col: number } | null>(
    null,
  );
  const [syncMap, setSyncMap] = useState<Record<string, SyncState>>({});
  const tableRef = useRef<HTMLDivElement>(null);

  const canWriteColumn = useCallback(
    (col: number) => canWritePipelineColumn(user.role, COLUMN_KEYS[col]),
    [user.role],
  );

  const isEditableCol = useCallback(
    (col: number) => canWriteColumn(col),
    [canWriteColumn],
  );

  const commitEdit = useCallback(
    (rowIndex: number, field: EditablePipelineField, rawValue: string) => {
      const row = data[rowIndex];
      if (!row) {
        setEditing(null);
        return;
      }

      const patch = buildSharePointPatch(field, rawValue);
      const patchValue = patch[field];

      if (patchValue === undefined || patchValue === row[field]) {
        setEditing(null);
        return;
      }

      const updatedRow: PipelineRow = { ...row, ...patch };

      onDataChange(
        data.map((item, index) => (index === rowIndex ? updatedRow : item)),
      );
      onRowUpdate?.(updatedRow);
      setEditing(null);
      setSyncMap((prev) => ({ ...prev, [row.id]: "syncing" }));

      void syncPipelineField(row.id, field, rawValue, user.role)
        .then(() => {
          setSyncMap((prev) => ({ ...prev, [row.id]: "synced" }));
          window.setTimeout(() => {
            setSyncMap((prev) =>
              prev[row.id] === "synced" ? { ...prev, [row.id]: "idle" } : prev,
            );
          }, 1400);
        })
        .catch(() => {
          setSyncMap((prev) => ({ ...prev, [row.id]: "error" }));
        });
    },
    [data, onDataChange, onRowUpdate, user.role],
  );

  const table = useReactTable({
    data,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  useCellKeyboard({
    rowCount: data.length,
    colCount: COLUMN_KEYS.length,
    position: focus,
    onMove: setFocus,
    disabled: editing !== null || navigationPaused,
    onEnter: () => {
      const row = data[focus.row];
      if (!row) return;

      if (isEditableCol(focus.col)) {
        setEditing({ row: focus.row, col: focus.col });
        return;
      }

      onSelect(row);
    },
  });

  const renderNumericEditableCell = (
    row: PipelineRow,
    rowIndex: number,
    colIndex: number,
    field: "reactorDesignCapacity" | "salesValue" | "probability",
  ) => {
    const isFocused =
      focus.row === rowIndex && focus.col === colIndex && editing === null;
    const isEditing = editing?.row === rowIndex && editing?.col === colIndex;
    const readOnly = !canWriteColumn(colIndex);

    if (field === "probability") {
      return (
        <ProbabilityBadge
          probability={row.probability}
          editing={isEditing}
          focused={isFocused}
          readOnly={readOnly}
          onStartEdit={() => setEditing({ row: rowIndex, col: colIndex })}
          onCommit={(value) => commitEdit(rowIndex, "probability", value)}
          onCancel={() => setEditing(null)}
        />
      );
    }

    if (readOnly) {
      return (
        <StaticCell
          value={getEditableCellDisplayValue(row, field)}
          mono
          bold={field === "salesValue"}
          focused={isFocused}
        />
      );
    }

    if (isEditing) {
      return (
        <EditableCell
          value={getEditableCellValue(row, field)}
          editing
          focused={isFocused}
          mono
          onStartEdit={() => setEditing({ row: rowIndex, col: colIndex })}
          onCommit={(value) => commitEdit(rowIndex, field, value)}
          onCancel={() => setEditing(null)}
        />
      );
    }

    return (
      <EditableCell
        value={getEditableCellDisplayValue(row, field)}
        editing={false}
        focused={isFocused}
        mono
        bold={field === "salesValue"}
        onStartEdit={() => setEditing({ row: rowIndex, col: colIndex })}
        onCommit={(value) => commitEdit(rowIndex, field, value)}
        onCancel={() => setEditing(null)}
      />
    );
  };

  const renderCell = (row: PipelineRow, rowIndex: number, colIndex: number) => {
    const field = COLUMN_KEYS[colIndex];
    const isFocused =
      focus.row === rowIndex && focus.col === colIndex && editing === null;
    const isEditing = editing?.row === rowIndex && editing?.col === colIndex;
    const readOnly = !canWriteColumn(colIndex);

    if (field === "id") {
      return (
        <span className="font-mono text-[11px] text-carbon-blue/55">{row.id}</span>
      );
    }

    if (field === "companyRole") {
      return <EnterpriseRoleBadge role={row.companyRole} />;
    }

    if (
      field === "reactorDesignCapacity" ||
      field === "salesValue" ||
      field === "probability"
    ) {
      return renderNumericEditableCell(row, rowIndex, colIndex, field);
    }

    if (field === "status") {
      if (isEditing && !readOnly) {
        return (
          <PhaseGateSelect
            status={row.status}
            focused={isFocused}
            onCommit={(value) => commitEdit(rowIndex, "status", value)}
            onCancel={() => setEditing(null)}
          />
        );
      }

      if (readOnly) {
        return <PhaseGateBadge status={row.status} />;
      }

      return (
        <button
          type="button"
          onDoubleClick={() => setEditing({ row: rowIndex, col: colIndex })}
          className={isFocused ? "ring-1 ring-upcycle-orange/40 ring-inset" : ""}
        >
          <PhaseGateBadge status={row.status} />
        </button>
      );
    }

    if (field === "assetName") {
      if (readOnly) {
        return (
          <StaticCell value={row.assetName} bold focused={isFocused} />
        );
      }

      return (
        <EditableCell
          value={row.assetName}
          editing={isEditing}
          focused={isFocused}
          bold
          onStartEdit={() => setEditing({ row: rowIndex, col: colIndex })}
          onCommit={(value) => commitEdit(rowIndex, "assetName", value)}
          onCancel={() => setEditing(null)}
        />
      );
    }

    return null;
  };

  return (
    <div
      ref={tableRef}
      tabIndex={0}
      className="outline-none"
      onFocus={() => tableRef.current?.focus()}
    >
      <section className="border border-carbon-blue/15 bg-white">
        <header className="border-b border-carbon-blue/10 px-3 py-2">
          <h2 className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45">
            Active Deals Pipeline
          </h2>
        </header>
        <div className="overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-left">
          <colgroup>
            {tableColumns.map((col, index) => (
              <col
                key={`colgroup-pyro-${index}`}
                style={{ width: col.size }}
              />
            ))}
            <col key="colgroup-pyro-sync-dot" style={{ width: 20 }} />
          </colgroup>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr
                key={headerGroup.id}
                className="border-b border-carbon-blue/15 bg-light-grey/40"
              >
                {headerGroup.headers.map((header, index) => (
                  <th
                    key={`th-pyro-${index}`}
                    className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45"
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                  </th>
                ))}
                <th key="th-pyro-sync-spacer" aria-hidden className="w-5" />
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, rowIndex) => {
              const sync = syncMap[row.original.id] ?? "idle";
              const rowFocused = focus.row === rowIndex && editing === null;

              return (
                <tr
                  key={row.id}
                  className={`cursor-pointer border-b border-carbon-blue/10 last:border-b-0 ${
                    rowFocused
                      ? "bg-upcycle-orange/[0.04]"
                      : "hover:bg-light-grey/70"
                  }`}
                >
                  {row.getVisibleCells().map((cell, colIndex) => {
                    const field = COLUMN_KEYS[colIndex];
                    const opensDrawer =
                      field === "id" || (field === "status" && !canWriteColumn(colIndex));

                    return (
                      <td
                        key={cell.id}
                        className={`px-2 py-1 ${
                          focus.row === rowIndex && focus.col === colIndex
                            ? "bg-upcycle-orange/[0.06]"
                            : ""
                        }`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setFocus({ row: rowIndex, col: colIndex });
                          if (opensDrawer) onSelect(row.original);
                        }}
                      >
                        {renderCell(row.original, rowIndex, colIndex)}
                      </td>
                    );
                  })}
                  <td
                    key={`${row.id}-pyro-sync`}
                    className="px-1 py-1"
                    onClick={() => onSelect(row.original)}
                  >
                    <SyncDot state={sync} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </section>
    </div>
  );
}
