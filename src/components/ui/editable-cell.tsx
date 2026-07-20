"use client";

import { useEffect, useRef } from "react";

type EditableCellProps = {
  value: string;
  editing: boolean;
  focused: boolean;
  onStartEdit: () => void;
  onCommit: (value: string) => void;
  onCancel: () => void;
  className?: string;
  mono?: boolean;
  bold?: boolean;
};

export function EditableCell({
  value,
  editing,
  focused,
  onStartEdit,
  onCommit,
  onCancel,
  className = "",
  mono = false,
  bold = false,
}: EditableCellProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        defaultValue={value}
        className={`w-full border border-upcycle-orange bg-white px-1 py-0 text-xs text-carbon-blue outline-none ${mono ? "font-mono" : ""} ${bold ? "font-medium" : ""}`}
        onBlur={(event) => onCommit(event.target.value)}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Enter") {
            event.preventDefault();
            onCommit(event.currentTarget.value);
          }
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
        }}
      />
    );
  }

  return (
    <button
      type="button"
      onDoubleClick={onStartEdit}
      className={`block w-full truncate text-left text-xs ${mono ? "font-mono text-[11px] text-carbon-blue/60" : "text-carbon-blue"} ${bold ? "font-medium" : ""} ${focused ? "ring-1 ring-upcycle-orange/40 ring-inset" : ""} ${className}`}
    >
      {value}
    </button>
  );
}
