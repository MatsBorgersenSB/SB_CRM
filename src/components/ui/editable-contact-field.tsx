"use client";

import { useEffect, useRef, useState } from "react";
import type { EditableContactField } from "@/types/contact";
import { SmartCRMIcon } from "@/components/ui/smartcrm-icon";

type EditableContactFieldProps = {
  value: string;
  field: EditableContactField;
  onCommit: (value: string) => Promise<void>;
};

const shellStyles: Record<EditableContactField, string> = {
  Email: "min-h-[16px]",
  Phone: "min-h-[16px]",
  Mobile: "min-h-[16px]",
  LinkedInURL: "min-h-[16px]",
  JobTitle: "min-h-[16px]",
};

const staticStyles: Record<EditableContactField, string> = {
  Email:
    "flex h-[16px] w-full items-center truncate text-left font-mono text-xs text-carbon-blue/50 transition-colors hover:text-upcycle-orange",
  Phone:
    "flex h-[16px] w-full items-center truncate text-left font-mono text-xs text-carbon-blue/50",
  Mobile:
    "flex h-[16px] w-full items-center truncate text-left font-mono text-xs text-carbon-blue/50",
  LinkedInURL:
    "flex h-[16px] w-full items-center truncate text-left font-mono text-xs text-carbon-blue/50 transition-colors hover:text-upcycle-orange",
  JobTitle:
    "flex h-[16px] w-full items-center truncate text-left text-xs text-carbon-blue/50 transition-colors hover:text-upcycle-orange",
};

const inputStyles: Record<EditableContactField, string> = {
  Email:
    "h-[16px] w-full border border-upcycle-orange bg-transparent p-0 font-mono text-xs text-carbon-blue outline-none",
  Phone:
    "h-[16px] w-full border border-upcycle-orange bg-transparent p-0 font-mono text-xs text-carbon-blue outline-none",
  Mobile:
    "h-[16px] w-full border border-upcycle-orange bg-transparent p-0 font-mono text-xs text-carbon-blue outline-none",
  LinkedInURL:
    "h-[16px] w-full border border-upcycle-orange bg-transparent p-0 font-mono text-xs text-carbon-blue outline-none",
  JobTitle:
    "h-[16px] w-full border border-upcycle-orange bg-transparent p-0 text-xs text-carbon-blue outline-none",
};

export function EditableContactField({
  value,
  field,
  onCommit,
}: EditableContactFieldProps) {
  const [editing, setEditing] = useState(false);
  const [displayValue, setDisplayValue] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDisplayValue(value);
  }, [value]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = async (nextValue: string) => {
    const trimmed = nextValue.trim();

    if (trimmed === displayValue) {
      setEditing(false);
      return;
    }

    if (!trimmed && field !== "Mobile" && field !== "LinkedInURL") {
      setEditing(false);
      return;
    }

    setSaving(true);

    try {
      await onCommit(trimmed);
      setDisplayValue(trimmed);
      setEditing(false);
    } catch {
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={shellStyles[field]}>
      {editing ? (
        <input
          ref={inputRef}
          type={field === "Email" ? "email" : "text"}
          defaultValue={displayValue}
          disabled={saving}
          className={inputStyles[field]}
          onBlur={(event) => {
            void commit(event.target.value);
          }}
          onKeyDown={(event) => {
            event.stopPropagation();

            if (event.key === "Enter") {
              event.preventDefault();
              void commit(event.currentTarget.value);
            }

            if (event.key === "Escape") {
              event.preventDefault();
              setEditing(false);
            }
          }}
        />
      ) : (
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setEditing(true);
          }}
          className={`group/edit flex w-full items-center gap-1 ${staticStyles[field]}`}
        >
          <SmartCRMIcon
            name="edit"
            size="xs"
            className="opacity-0 transition-opacity group-hover/edit:opacity-60"
            label="Edit"
          />
          <span className="min-w-0 truncate">{displayValue || "—"}</span>
        </button>
      )}
    </div>
  );
}
