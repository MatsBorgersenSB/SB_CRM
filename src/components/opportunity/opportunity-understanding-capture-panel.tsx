"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PipelineRow } from "@/types/pipeline";
import type { UnderstandingFieldId } from "@/types/opportunity-understanding";
import { isUnderstandingFieldId } from "@/types/opportunity-understanding";
import { understandingFieldsForPipeline } from "@/lib/sales-motion";
import {
  confirmedFindingClaimsForField,
  proposedFindingClaimsForField,
  resolveUnderstandingField,
} from "@/lib/opportunity-understanding-model";
import {
  applySourceFindingDecision,
  type SourceFinding,
  type SourceFindingDecision,
} from "@/lib/source-findings";
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
  onSaveFindings,
  onReadDocuments,
  documentCount = 0,
  readOnly = false,
}: {
  pipeline: PipelineRow;
  focusFieldId?: string | null;
  onSaveField?: (fieldId: UnderstandingFieldId, value: string) => Promise<void>;
  onSaveFindings?: (findings: SourceFinding[]) => Promise<void>;
  onReadDocuments?: () => Promise<SourceFinding[]>;
  documentCount?: number;
  readOnly?: boolean;
}) {
  const focusId = isUnderstandingFieldId(focusFieldId) ? focusFieldId : null;
  const fields = useMemo(() => understandingFieldsForPipeline(pipeline), [pipeline]);
  const findings = useMemo(
    () => pipeline.understanding?.findings ?? [],
    [pipeline.understanding?.findings],
  );
  const [syncingSources, setSyncingSources] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const handleSyncSources = async () => {
    if (!onReadDocuments || !onSaveFindings || syncingSources) return;
    setSyncingSources(true);
    setSyncError(null);
    setSyncNotice(null);
    try {
      const proposed = await onReadDocuments();
      if (proposed.length === 0) {
        setSyncNotice("No new source findings detected.");
        return;
      }
      const { appendSourceFinding } = await import("@/lib/source-findings");
      let next = findings;
      for (const item of proposed) {
        next = appendSourceFinding(next, item);
      }
      await onSaveFindings(next);
      setSyncNotice(
        `Scanned ${proposed.length} source${proposed.length === 1 ? "" : "s"} (documents, pictures, emails & activities). Review and confirm facts below.`,
      );
    } catch (err) {
      setSyncError(
        err instanceof Error ? err.message : "Could not read opportunity sources.",
      );
    } finally {
      setSyncingSources(false);
    }
  };

  // One list, unknowns first. Order within each group: priority, then the most
  // decision-critical customer facts, then model order.
  const { unknown, known } = useMemo(() => {
    const rank = { high: 0, medium: 1, low: 2 } as const;
    const critical: UnderstandingFieldId[] = [
      "customer_problem",
      "decision_maker",
      "economic_buyer",
      "why_now",
    ];
    const weight = (id: UnderstandingFieldId) => {
      const index = critical.indexOf(id);
      return index === -1 ? critical.length : index;
    };
    const indexed = fields.map((field, index) => ({
      field,
      index,
      empty: resolveUnderstandingField(pipeline, field.id).source === "empty",
    }));
    const byUrgency = (a: (typeof indexed)[number], b: (typeof indexed)[number]) =>
      rank[a.field.priority] - rank[b.field.priority] ||
      weight(a.field.id) - weight(b.field.id) ||
      a.index - b.index;
    return {
      unknown: indexed.filter((row) => row.empty).sort(byUrgency).map((row) => row.field),
      known: indexed.filter((row) => !row.empty).map((row) => row.field),
    };
  }, [fields, pipeline]);

  const handleDecideFindingClaim = async (
    findingId: string,
    claimId: string,
    decision: SourceFindingDecision,
  ) => {
    if (!onSaveFindings) return;
    const next = applySourceFindingDecision(findings, findingId, claimId, decision);
    await onSaveFindings(next);
  };

  const renderRow = (field: (typeof fields)[number]) => (
    <UnderstandingFieldRow
      key={field.id}
      pipeline={pipeline}
      fieldId={field.id}
      focused={focusId === field.id}
      readOnly={readOnly || !onSaveField}
      onSave={onSaveField}
      onDecideClaim={onSaveFindings ? handleDecideFindingClaim : undefined}
    />
  );

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className={EDITORIAL_LABEL}>What we know and what we don&apos;t</p>
          <p className="mt-1 text-[13px] text-carbon-blue/55">
            All client &amp; subsupplier communications, documents, drawings, and pictures flow here as knowledge.
          </p>
        </div>
        {!readOnly && onReadDocuments && onSaveFindings ? (
          <button
            type="button"
            disabled={syncingSources}
            onClick={() => void handleSyncSources()}
            className="inline-flex shrink-0 items-center rounded-md border border-upcycle-orange/40 bg-upcycle-orange/[0.06] px-3.5 py-2 text-[13px] font-semibold text-upcycle-orange transition-colors hover:bg-upcycle-orange/12 disabled:opacity-50"
          >
            {syncingSources
              ? "Reading sources…"
              : documentCount > 0
                ? `Extract knowledge from ${documentCount} document${documentCount === 1 ? "" : "s"}, pictures & emails`
                : "Extract knowledge from documents, pictures & emails"}
          </button>
        ) : null}
      </div>

      {syncNotice ? (
        <p className="-mt-6 text-[13px] font-medium text-emerald-700" role="status">
          {syncNotice}
        </p>
      ) : null}
      {syncError ? (
        <p className="-mt-6 text-[13px] font-medium text-thermal-red" role="alert">
          {syncError}
        </p>
      ) : null}

      {unknown.length > 0 ? (
        <section aria-labelledby="understanding-unknown">
          <h2 id="understanding-unknown" className="text-[13px] font-semibold text-carbon-blue">
            Not known yet ({unknown.length})
          </h2>
          <div className="mt-3 flex flex-col gap-4">{unknown.map(renderRow)}</div>
        </section>
      ) : null}

      {known.length > 0 ? (
        <section aria-labelledby="understanding-known">
          <h2 id="understanding-known" className="text-[13px] font-semibold text-carbon-blue">
            What we know ({known.length})
          </h2>
          <div className="mt-3 flex flex-col gap-4">{known.map(renderRow)}</div>
        </section>
      ) : null}
    </div>
  );
}

function UnderstandingFieldRow({
  pipeline,
  fieldId,
  focused,
  readOnly,
  onSave,
  onDecideClaim,
}: {
  pipeline: PipelineRow;
  fieldId: UnderstandingFieldId;
  focused: boolean;
  readOnly: boolean;
  onSave?: (fieldId: UnderstandingFieldId, value: string) => Promise<void>;
  onDecideClaim?: (
    findingId: string,
    claimId: string,
    decision: SourceFindingDecision,
  ) => Promise<void>;
}) {
  const resolved = useMemo(
    () => resolveUnderstandingField(pipeline, fieldId),
    [pipeline, fieldId],
  );
  const proposedClaims = useMemo(
    () => proposedFindingClaimsForField(pipeline.understanding?.findings, fieldId),
    [pipeline.understanding?.findings, fieldId],
  );
  const confirmedClaims = useMemo(
    () => confirmedFindingClaimsForField(pipeline.understanding?.findings, fieldId),
    [pipeline.understanding?.findings, fieldId],
  );
  const [claimBusy, setClaimBusy] = useState<string | null>(null);
  const [draft, setDraft] = useState(
    resolved.source === "captured" ? resolved.value : "",
  );
  const [localCaptured, setLocalCaptured] = useState(
    resolved.source === "captured" ? resolved.value : "",
  );
  const [editing, setEditing] = useState(focused && !readOnly);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const capturedValue =
    resolved.source === "captured" ? resolved.value : localCaptured.trim();
  const displaySource = capturedValue
    ? ("captured" as const)
    : resolved.source;

  useEffect(() => {
    if (resolved.source === "captured") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- mirror the captured value into the draft
      setDraft(resolved.value);
      setLocalCaptured(resolved.value);
    }
  }, [resolved.source, resolved.value]);

  useEffect(() => {
    if (!focused) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- enter edit mode when the field is focused from outside
    setEditing(!readOnly);
    containerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => inputRef.current?.focus(), 200);
  }, [focused, readOnly]);

  const category = categoryForSource(
    editing && draft.trim()
      ? "captured"
      : displaySource === "empty" && !draft.trim()
        ? "empty"
        : displaySource,
  );

  const displayValue =
    displaySource === "empty" && !editing
      ? "Unknown — answer here"
      : displaySource === "derived" && !editing
        ? resolved.value
        : capturedValue || draft || resolved.value;

  const handleSave = async () => {
    if (!onSave) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(fieldId, draft);
      setLocalCaptured(draft.trim());
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
        <p className="text-[13px] font-semibold text-carbon-blue">
          {resolved.definition.label}
        </p>
        <SmartAssistCategoryBadge category={category} />
        <SmartAssistConfidenceLabel
          confidence={
            category === "known" ? "high" : category === "assumed" ? "medium" : "low"
          }
        />
      </div>
      <p className="mt-1 text-[13px] text-carbon-blue/55">{resolved.definition.prompt}</p>

      {editing && !readOnly ? (
        <div className="mt-3">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={2}
            placeholder={resolved.definition.placeholder}
            className="w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[13px] text-carbon-blue placeholder:text-carbon-blue/50"
          />
          {resolved.source === "derived" && !draft.trim() && !capturedValue ? (
            <p className="mt-1 text-[12px] text-carbon-blue/65">
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
                setDraft(capturedValue || (displaySource === "captured" ? resolved.value : ""));
                setError(null);
                setEditing(false);
              }}
              className="px-3 py-1.5 text-xs font-semibold text-carbon-blue/55 hover:text-carbon-blue"
            >
              Cancel
            </button>
          </div>
          {error ? (
            <p className="mt-2 text-[12px] text-thermal-red">{error}</p>
          ) : null}
        </div>
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <p
              className={`whitespace-pre-line text-[13px] leading-relaxed ${
                displaySource === "empty" ? "text-carbon-blue/65" : "text-carbon-blue"
              }`}
            >
              {displayValue}
            </p>
            {!readOnly ? (
              <button
                type="button"
                onClick={() => {
                  setDraft(capturedValue || "");
                  setEditing(true);
                }}
                className="shrink-0 text-[12px] font-semibold text-upcycle-orange hover:underline"
              >
                {displaySource === "empty" ? "Answer now" : "Edit"}
              </button>
            ) : null}
          </div>

          {confirmedClaims.length > 0 ? (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {confirmedClaims.map(({ finding, claim }) => (
                <span
                  key={claim.id}
                  className="inline-flex items-center gap-1 rounded border border-emerald-600/25 bg-emerald-50/70 px-2 py-0.5 text-[11px] font-medium text-emerald-800"
                >
                  Confirmed from {finding.title}
                </span>
              ))}
            </div>
          ) : null}

          {proposedClaims.length > 0 ? (
            <div className="mt-1.5 space-y-2 rounded-md border border-upcycle-orange/30 bg-upcycle-orange/[0.04] px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-upcycle-orange">
                Proposed from documents, pictures &amp; correspondence
              </p>
              {proposedClaims.map(({ finding, claim }) => (
                <div
                  key={claim.id}
                  className="flex flex-wrap items-start justify-between gap-2 border-t border-upcycle-orange/15 pt-1.5 first:border-t-0 first:pt-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-medium text-carbon-blue">
                      {claim.statement}
                    </p>
                    <p className="text-[11px] text-carbon-blue/60">
                      Source: {finding.title} · {claim.impact}
                    </p>
                  </div>
                  {!readOnly && onDecideClaim ? (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        disabled={claimBusy === claim.id}
                        onClick={async () => {
                          setClaimBusy(claim.id);
                          try {
                            await onDecideClaim(finding.id, claim.id, "confirmed");
                          } finally {
                            setClaimBusy(null);
                          }
                        }}
                        className="rounded bg-upcycle-orange px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-upcycle-orange/90 disabled:opacity-50"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        disabled={claimBusy === claim.id}
                        onClick={async () => {
                          setClaimBusy(claim.id);
                          try {
                            await onDecideClaim(finding.id, claim.id, "dismissed");
                          } finally {
                            setClaimBusy(null);
                          }
                        }}
                        className="rounded px-2 py-1 text-[11px] font-medium text-carbon-blue/55 hover:bg-carbon-blue/5 disabled:opacity-50"
                      >
                        Dismiss
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
