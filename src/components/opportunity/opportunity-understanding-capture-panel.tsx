"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PipelineRow } from "@/types/pipeline";
import type { UnderstandingFieldId } from "@/types/opportunity-understanding";
import { isUnderstandingFieldId } from "@/types/opportunity-understanding";
import { resolveSalesMotion, understandingFieldsForPipeline } from "@/lib/sales-motion";
import { isOpenWorkNote } from "@/lib/opportunity-deal-brief";
import {
  buildPillarExecutionDraft,
  DEVELOPMENT_PILLARS,
  isDevelopmentAlsoNeededField,
  isDevelopmentPillarField,
  isHostPlantClaim,
  type LinkedWorkItem,
  type PillarCounterpartyBinding,
} from "@/lib/development-pillars";
import {
  evaluatePipelineFelMassEnergy,
  formatArchetypeLabel,
} from "@/lib/fel-mass-energy-engine";
import { CompanyLink, ContactLink } from "@/components/relationship/relationship-links";
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

/** Development checklist fields (FS-005B): answers here can say the work is still open. */
const BOO_CHECKLIST_FIELD_IDS: UnderstandingFieldId[] = [
  "site_readiness",
  "feedstock_agreement",
  "utilities",
  "offtake_strategy",
  "end_product",
  "public_funding",
  "permitting",
  "funding_source",
];

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
  linkedWork,
  pillarCounterparties,
  onLinkCounterparty,
}: {
  pipeline: PipelineRow;
  /** Project milestones and decisions grouped under the development step they belong to. */
  linkedWork?: Partial<Record<UnderstandingFieldId, LinkedWorkItem[]>>;
  /** Counterparty organization, signatory stakeholder, and last touch bound to each FEL pillar. */
  pillarCounterparties?: Partial<Record<UnderstandingFieldId, PillarCounterpartyBinding>>;
  /** Navigate to Organizations action tab when a pillar counterparty is not linked yet. */
  onLinkCounterparty?: () => void;
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
  // decision-critical facts (development pillars for BOO, customer layer for system sale), then model order.
  const { unknown, known } = useMemo(() => {
    const rank = { high: 0, medium: 1, low: 2 } as const;
    const isBoo = resolveSalesMotion(pipeline).motion === "boo";
    const critical: UnderstandingFieldId[] = isBoo
      ? [
          "site_readiness",
          "feedstock_agreement",
          "utilities",
          "offtake_strategy",
          "end_product",
          "public_funding",
          "permitting",
          "funding_source",
          "decision_maker",
          "why_now",
        ]
      : [
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

  const development = resolveSalesMotion(pipeline).motion === "boo";
  const [simTonnesInput, setSimTonnesInput] = useState("");
  const [simMoistureInput, setSimMoistureInput] = useState("");

  const felEvaluation = useMemo(() => {
    if (!development) return null;
    const t = Number(simTonnesInput.trim());
    const m = Number(simMoistureInput.trim());
    return evaluatePipelineFelMassEnergy(
      pipeline,
      Number.isFinite(t) && t > 0 ? t : null,
      Number.isFinite(m) && m >= 5 && m <= 85 ? m : null,
    );
  }, [development, pipeline, simTonnesInput, simMoistureInput]);

  const renderRow = (field: (typeof fields)[number], step?: number) => (
    <UnderstandingFieldRow
      key={field.id}
      pipeline={pipeline}
      fieldId={field.id}
      step={step}
      development={development}
      linkedWork={linkedWork?.[field.id]}
      counterparty={pillarCounterparties?.[field.id]}
      onLinkCounterparty={onLinkCounterparty}
      felPillarSummary={felEvaluation?.ready ? felEvaluation.pillarSummaries[field.id] : undefined}
      focused={focusId === field.id}
      readOnly={readOnly || !onSaveField}
      onSave={onSaveField}
      onDecideClaim={onSaveFindings ? handleDecideFindingClaim : undefined}
    />
  );

  // Development checklist: one card per step, in order. Each card holds only that step's issues.
  const steps = useMemo(
    () =>
      DEVELOPMENT_PILLARS.map((pillar) => fields.find((f) => f.id === pillar.fieldId)).filter(
        (f): f is (typeof fields)[number] => Boolean(f),
      ),
    [fields],
  );
  const alsoNeeded = useMemo(
    () => fields.filter((f) => isDevelopmentAlsoNeededField(f.id)),
    [fields],
  );
  const background = useMemo(
    () =>
      fields.filter((f) => !isDevelopmentPillarField(f.id) && !isDevelopmentAlsoNeededField(f.id)),
    [fields],
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
              ? "Reading sources & FEL registries…"
              : documentCount > 0
                ? `Extract knowledge from ${documentCount} document${documentCount === 1 ? "" : "s"}, emails & FEL radar`
                : "Extract knowledge from documents, emails & FEL radar"}
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

      {development ? (
        <>
          {felEvaluation ? (
            <section
              aria-label="FEL 1 mass, energy and carbon balance"
              className="border border-carbon-blue/12 bg-carbon-blue/[0.015] px-4 py-3.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-carbon-blue/60">
                    FEL 1 Mass, Energy &amp; Carbon Balance ({formatArchetypeLabel(felEvaluation.ready ? felEvaluation.input.archetype : felEvaluation.archetype)})
                  </p>
                  {felEvaluation.ready ? (
                    <p className="mt-1 text-[13px] text-carbon-blue">
                      <span className="font-semibold">
                        {felEvaluation.input.wetTonnesRangeLabel ??
                          `${felEvaluation.input.wetTonnesPerYear.toLocaleString("en-US")} t/yr`}
                      </span>{" "}
                      at {Math.round(felEvaluation.input.inletMoistureFraction * 100)}% moisture (
                      {felEvaluation.input.moistureSource}) →{" "}
                      <span className="font-semibold">
                        {felEvaluation.reactorLines} reactor line{felEvaluation.reactorLines === 1 ? "" : "s"}
                      </span>{" "}
                      ({felEvaluation.dryKgPerHour} kg DM/h) ·{" "}
                      <span className="font-semibold text-emerald-800">
                        ~{felEvaluation.netExportThermalGwhPerYear} GWh/yr
                      </span>{" "}
                      net surplus heat ({felEvaluation.netExportThermalMw} MWth) ·{" "}
                      <span className="font-semibold">
                        ~{felEvaluation.biocharTonnesPerYear.toLocaleString("en-US")} t/yr
                      </span>{" "}
                      biochar (~{felEvaluation.corcTonnesCo2ePerYear.toLocaleString("en-US")} tCO2e/yr CORCs) ·{" "}
                      ~{felEvaluation.estimatedElectricalLoadKw} kWe tie-in
                    </p>
                  ) : (
                    <p className="mt-1 text-[12px] text-carbon-blue/65">
                      {felEvaluation.missingReason}
                    </p>
                  )}
                </div>
                <details className="text-[12px]">
                  <summary className="cursor-pointer font-semibold text-upcycle-orange hover:underline">
                    {felEvaluation.ready ? "Adjust FEL 1 inputs" : "Simulate FEL 1 balance"}
                  </summary>
                  <div className="mt-2 flex flex-wrap items-center gap-2 rounded border border-carbon-blue/15 bg-white p-2">
                    <label className="flex items-center gap-1 text-[11px] text-carbon-blue/75">
                      Wet t/yr:
                      <input
                        type="number"
                        min={500}
                        step={500}
                        value={simTonnesInput}
                        onChange={(e) => setSimTonnesInput(e.target.value)}
                        placeholder={
                          felEvaluation.ready ? String(felEvaluation.input.wetTonnesPerYear) : "9000"
                        }
                        className="w-24 border border-carbon-blue/20 px-2 py-1 text-[12px] text-carbon-blue"
                      />
                    </label>
                    <label className="flex items-center gap-1 text-[11px] text-carbon-blue/75">
                      Moisture %:
                      <input
                        type="number"
                        min={5}
                        max={85}
                        step={1}
                        value={simMoistureInput}
                        onChange={(e) => setSimMoistureInput(e.target.value)}
                        placeholder={
                          felEvaluation.ready
                            ? String(Math.round(felEvaluation.input.inletMoistureFraction * 100))
                            : "30"
                        }
                        className="w-16 border border-carbon-blue/20 px-2 py-1 text-[12px] text-carbon-blue"
                      />
                    </label>
                    {(simTonnesInput || simMoistureInput) ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSimTonnesInput("");
                          setSimMoistureInput("");
                        }}
                        className="text-[11px] font-medium text-carbon-blue/60 hover:text-carbon-blue"
                      >
                        Reset to record
                      </button>
                    ) : null}
                  </div>
                </details>
              </div>
            </section>
          ) : null}

          <section aria-labelledby="development-steps">
            <h2 id="development-steps" className="text-[13px] font-semibold text-carbon-blue">
              The {steps.length} things we must secure
            </h2>
            <p className="mt-1 text-[12px] text-carbon-blue/55">
              Each step shows only what belongs to that step.
            </p>
            <div className="mt-3 flex flex-col gap-4">
              {steps.map((field, index) => renderRow(field, index + 1))}
            </div>
          </section>
          {alsoNeeded.length > 0 ? (
            <section aria-labelledby="development-also">
              <h2 id="development-also" className="text-[13px] font-semibold text-carbon-blue">
                Also needed for the plant
              </h2>
              <div className="mt-3 flex flex-col gap-4">{alsoNeeded.map((f) => renderRow(f))}</div>
            </section>
          ) : null}
          {background.length > 0 ? (
            <details className="group">
              <summary className="cursor-pointer text-[13px] font-semibold text-carbon-blue">
                Background and engineering ({background.length})
              </summary>
              <p className="mt-1 text-[12px] text-carbon-blue/55">
                Useful context. Not one of the steps above.
              </p>
              <div className="mt-3 flex flex-col gap-4">{background.map((f) => renderRow(f))}</div>
            </details>
          ) : null}
        </>
      ) : null}

      {!development && unknown.length > 0 ? (
        <section aria-labelledby="understanding-unknown">
          <h2 id="understanding-unknown" className="text-[13px] font-semibold text-carbon-blue">
            Not known yet ({unknown.length})
          </h2>
          <div className="mt-3 flex flex-col gap-4">{unknown.map(renderRow)}</div>
        </section>
      ) : null}

      {!development && known.length > 0 ? (
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
  step,
  development = false,
  linkedWork,
  counterparty,
  onLinkCounterparty,
  felPillarSummary,
  focused,
  readOnly,
  onSave,
  onDecideClaim,
}: {
  pipeline: PipelineRow;
  fieldId: UnderstandingFieldId;
  /** Position on the development checklist (1-based). */
  step?: number;
  /** Development project: evidence about the host's own plant is not shown on our steps. */
  development?: boolean;
  linkedWork?: LinkedWorkItem[];
  counterparty?: PillarCounterpartyBinding;
  onLinkCounterparty?: () => void;
  felPillarSummary?: string;
  focused: boolean;
  readOnly: boolean;
  onSave?: (fieldId: UnderstandingFieldId, value: string) => Promise<void>;
  onDecideClaim?: (
    findingId: string,
    claimId: string,
    decision: SourceFindingDecision,
  ) => Promise<void>;
}) {
  const [copiedBrief, setCopiedBrief] = useState(false);
  const resolved = useMemo(
    () => resolveUnderstandingField(pipeline, fieldId),
    [pipeline, fieldId],
  );
  const proposedClaims = useMemo(
    () =>
      proposedFindingClaimsForField(pipeline.understanding?.findings, fieldId).filter(
        ({ claim }) => !development || !isHostPlantClaim(claim.statement, claim.plantScope),
      ),
    [pipeline.understanding?.findings, fieldId, development],
  );
  const confirmedClaims = useMemo(
    () =>
      confirmedFindingClaimsForField(pipeline.understanding?.findings, fieldId).filter(
        ({ claim }) => !development || !isHostPlantClaim(claim.statement, claim.plantScope),
      ),
    [pipeline.understanding?.findings, fieldId, development],
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

  // Same rule as the Overview checklist: an answer that says "to be secured" is still open work.
  const stillOpen =
    BOO_CHECKLIST_FIELD_IDS.includes(fieldId) &&
    resolveSalesMotion(pipeline).motion === "boo" &&
    isOpenWorkNote(capturedValue);

  const category = stillOpen
    ? ("assumed" as const)
    : categoryForSource(
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

  const isDevelopmentStep =
    development && (isDevelopmentPillarField(fieldId) || isDevelopmentAlsoNeededField(fieldId));

  const executionDraft = useMemo(() => {
    if (!isDevelopmentStep) return null;
    return buildPillarExecutionDraft({
      projectName: pipeline.assetName || "Project",
      fieldId,
      capturedNote: capturedValue || undefined,
      binding: counterparty,
    });
  }, [isDevelopmentStep, pipeline.assetName, fieldId, capturedValue, counterparty]);

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
          {step ? `${step}. ` : ""}
          {resolved.definition.label}
        </p>
        <SmartAssistCategoryBadge category={category} />
        {stillOpen ? (
          <span className="text-[11px] font-medium text-upcycle-orange">
            Still open — not secured yet
          </span>
        ) : (
          <SmartAssistConfidenceLabel
            confidence={
              category === "known" ? "high" : category === "assumed" ? "medium" : "low"
            }
          />
        )}
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
              <div className="flex shrink-0 items-center gap-3">
                {felPillarSummary && displaySource === "empty" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDraft(felPillarSummary);
                      setEditing(true);
                    }}
                    className="text-[12px] font-medium text-carbon-blue/70 hover:text-upcycle-orange hover:underline"
                  >
                    Prefill FEL 1 balance
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setDraft(capturedValue || "");
                    setEditing(true);
                  }}
                  className="text-[12px] font-semibold text-upcycle-orange hover:underline"
                >
                  {displaySource === "empty" ? "Answer now" : "Edit"}
                </button>
              </div>
            ) : null}
          </div>

          {isDevelopmentStep && (counterparty || executionDraft) ? (
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2 rounded-md border border-carbon-blue/10 bg-carbon-blue/[0.015] px-3 py-2 text-[12px] text-carbon-blue">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {counterparty?.companyId && counterparty.companyName ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-carbon-blue/55">
                      Counterparty:
                    </span>
                    <CompanyLink
                      companyId={counterparty.companyId}
                      className="font-semibold text-carbon-blue"
                    >
                      {counterparty.companyName}
                    </CompanyLink>
                    {counterparty.organizationRoleLabel ? (
                      <span className="text-carbon-blue/60">
                        ({counterparty.organizationRoleLabel})
                      </span>
                    ) : null}
                  </span>
                ) : counterparty?.missingCounterpartyReason ? (
                  <span className="inline-flex items-center gap-1.5 text-carbon-blue/65">
                    <span>{counterparty.missingCounterpartyReason}</span>
                    {onLinkCounterparty ? (
                      <button
                        type="button"
                        onClick={onLinkCounterparty}
                        className="font-semibold text-upcycle-orange hover:underline"
                      >
                        Link organization
                      </button>
                    ) : null}
                  </span>
                ) : null}

                {counterparty?.stakeholderName ? (
                  <span className="inline-flex items-center gap-1">
                    <span className="text-carbon-blue/55">Signatory / Contact:</span>
                    {counterparty.stakeholderContactId ? (
                      <ContactLink
                        contactId={counterparty.stakeholderContactId}
                        companyId={counterparty.companyId}
                        className="font-medium text-carbon-blue"
                      >
                        {counterparty.stakeholderName}
                      </ContactLink>
                    ) : (
                      <span className="font-medium text-carbon-blue">
                        {counterparty.stakeholderName}
                      </span>
                    )}
                    {counterparty.stakeholderRole ? (
                      <span className="text-carbon-blue/60">({counterparty.stakeholderRole})</span>
                    ) : null}
                  </span>
                ) : null}

                {counterparty?.internalLeadName ? (
                  <span className="text-carbon-blue/65">
                    SB lead: <span className="font-medium text-carbon-blue">{counterparty.internalLeadName}</span>
                  </span>
                ) : null}

                {counterparty?.lastTouchDate ? (
                  <span className="text-carbon-blue/60">
                    Last touch: {counterparty.lastTouchDate}
                  </span>
                ) : null}
              </div>

              {executionDraft && (category !== "known" || stillOpen) ? (
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={executionDraft.outlookWebHref}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center rounded border border-upcycle-orange/35 bg-upcycle-orange/[0.06] px-2.5 py-1 text-[11px] font-semibold text-upcycle-orange transition-colors hover:bg-upcycle-orange/12"
                  >
                    Prepare email in Outlook
                  </a>
                  <a
                    href={executionDraft.mailtoHref}
                    className="inline-flex items-center rounded border border-carbon-blue/15 bg-white px-2 py-1 text-[11px] font-medium text-carbon-blue/75 hover:border-carbon-blue/30 hover:text-carbon-blue"
                  >
                    Mail app
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard
                        ?.writeText(`${executionDraft.emailSubject}\n\n${executionDraft.emailBody}`)
                        .then(() => {
                          setCopiedBrief(true);
                          window.setTimeout(() => setCopiedBrief(false), 1800);
                        });
                    }}
                    className="inline-flex items-center rounded border border-carbon-blue/15 bg-white px-2 py-1 text-[11px] font-medium text-carbon-blue/75 hover:border-carbon-blue/30 hover:text-carbon-blue"
                  >
                    {copiedBrief ? "Copied" : "Copy brief"}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {linkedWork && linkedWork.length > 0 ? (
            <div className="mt-1 rounded-md border border-carbon-blue/10 bg-carbon-blue/[0.02] px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-carbon-blue/60">
                Being done for this step
              </p>
              <ul className="mt-1 flex flex-col gap-1">
                {linkedWork.map((item) => (
                  <li key={item.id} className="text-[12px] leading-snug text-carbon-blue">
                    <span className="font-semibold">
                      {item.kind === "decided" ? "Decided" : "To do"}
                      {item.date ? ` ${item.date}` : ""}:
                    </span>{" "}
                    {item.text}
                    <span className="text-carbon-blue/60">
                      {item.owner ? ` — ${item.owner}` : ""}
                      {item.status ? ` · ${item.status}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {confirmedClaims.length > 0 ? (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {confirmedClaims.map(({ finding, claim }) => (
                <span
                  key={`${finding.id}:${claim.id}`}
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
                  key={`${finding.id}:${claim.id}`}
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
