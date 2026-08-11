"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PipelineRow } from "@/types/pipeline";
import type { UnderstandingFieldId } from "@/types/opportunity-understanding";
import {
  UNDERSTANDING_CATEGORIES,
  UNDERSTANDING_CATEGORY_LABELS,
  fieldsForCategory,
  isUnderstandingFieldId,
} from "@/types/opportunity-understanding";
import { resolveUnderstandingField } from "@/lib/opportunity-understanding-model";
import {
  SmartAssistCategoryBadge,
  SmartAssistConfidenceLabel,
} from "@/components/smartassist/smartassist-intelligence-display";
import type { InsightCategory } from "@/types/smartassist-intelligence";
import { EDITORIAL_LABEL } from "@/lib/editorial-design-system";

function categoryForSource(source: "captured" | "derived" | "empty"): InsightCategory {
  if (source === "captured") return "known";
  if (source === "derived") return "assumed";
  return "unknown";
}

export function OpportunityUnderstandingCapturePanel({
  pipeline,
  focusFieldId,
  onSaveField,
  readOnly = false,
}: {
  pipeline: PipelineRow;
  focusFieldId?: string | null;
  onSaveField?: (fieldId: UnderstandingFieldId, value: string) => Promise<void>;
  readOnly?: boolean;
}) {
  const focusId = isUnderstandingFieldId(focusFieldId) ? focusFieldId : null;

  return (
    <div className="flex flex-col gap-10">
      <div>
        <p className={EDITORIAL_LABEL}>Opportunity understanding</p>
        <p className="mt-1 text-[13px] text-carbon-blue/55">
          Capture answers here. Gaps are generated automatically from what is still unknown.
        </p>
      </div>

      {UNDERSTANDING_CATEGORIES.map((category) => (
        <section key={category} aria-labelledby={`understanding-${category}`}>
          <h2
            id={`understanding-${category}`}
            className="text-[13px] font-semibold text-carbon-blue"
          >
            {UNDERSTANDING_CATEGORY_LABELS[category]}
          </h2>
          <div className="mt-3 flex flex-col gap-4">
            {fieldsForCategory(category).map((field) => (
              <UnderstandingFieldRow
                key={field.id}
                pipeline={pipeline}
                fieldId={field.id}
                focused={focusId === field.id}
                readOnly={readOnly || !onSaveField}
                onSave={onSaveField}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function UnderstandingFieldRow({
  pipeline,
  fieldId,
  focused,
  readOnly,
  onSave,
}: {
  pipeline: PipelineRow;
  fieldId: UnderstandingFieldId;
  focused: boolean;
  readOnly: boolean;
  onSave?: (fieldId: UnderstandingFieldId, value: string) => Promise<void>;
}) {
  const resolved = useMemo(
    () => resolveUnderstandingField(pipeline, fieldId),
    [pipeline, fieldId],
  );
  const [draft, setDraft] = useState(
    resolved.source === "captured" ? resolved.value : resolved.source === "derived" ? "" : "",
  );
  const [editing, setEditing] = useState(focused && !readOnly);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (resolved.source === "captured") {
      setDraft(resolved.value);
    }
  }, [resolved.source, resolved.value]);

  useEffect(() => {
    if (!focused) return;
    setEditing(!readOnly);
    containerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => inputRef.current?.focus(), 200);
  }, [focused, readOnly]);

  const category = categoryForSource(
    editing && draft.trim()
      ? "captured"
      : resolved.source === "empty" && !draft.trim()
        ? "empty"
        : resolved.source,
  );

  const displayValue =
    resolved.source === "empty" && !editing
      ? "Unknown — answer here"
      : resolved.source === "derived" && !editing
        ? resolved.value
        : draft || resolved.value;

  const handleSave = async () => {
    if (!onSave) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(fieldId, draft);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save answer.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      ref={containerRef}
      id={`understanding-field-${fieldId}`}
      className={`border px-4 py-3 transition-colors ${
        focused
          ? "border-upcycle-orange/40 bg-upcycle-orange/[0.04]"
          : "border-carbon-blue/10 bg-white"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[12px] font-semibold text-carbon-blue">
          {resolved.definition.label}
        </p>
        <SmartAssistCategoryBadge category={category} />
        <SmartAssistConfidenceLabel
          confidence={
            category === "known" ? "high" : category === "assumed" ? "medium" : "low"
          }
        />
      </div>
      <p className="mt-1 text-[12px] text-carbon-blue/55">{resolved.definition.prompt}</p>

      {editing && !readOnly ? (
        <div className="mt-3">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={2}
            placeholder={resolved.definition.placeholder}
            className="w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[13px] text-carbon-blue placeholder:text-carbon-blue/35"
          />
          {resolved.source === "derived" && !draft.trim() ? (
            <p className="mt-1 text-[11px] text-carbon-blue/45">
              Current record: {resolved.value}. Save a refined answer to confirm.
            </p>
          ) : null}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="border border-upcycle-orange bg-upcycle-orange px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save answer"}
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(resolved.source === "captured" ? resolved.value : "");
                setError(null);
                setEditing(false);
              }}
              className="px-3 py-1.5 text-xs font-semibold text-carbon-blue/55 hover:text-carbon-blue"
            >
              Cancel
            </button>
          </div>
          {error ? (
            <p className="mt-2 text-[11px] text-thermal-red">{error}</p>
          ) : null}
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
          <p
            className={`text-[13px] leading-relaxed ${
              resolved.source === "empty" ? "text-carbon-blue/45" : "text-carbon-blue"
            }`}
          >
            {displayValue}
          </p>
          {!readOnly ? (
            <button
              type="button"
              onClick={() => {
                setDraft(resolved.source === "captured" ? resolved.value : "");
                setEditing(true);
              }}
              className="shrink-0 text-[11px] font-semibold text-upcycle-orange hover:underline"
            >
              {resolved.source === "empty" ? "Answer now" : "Edit"}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
