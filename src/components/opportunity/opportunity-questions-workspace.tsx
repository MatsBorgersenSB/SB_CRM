"use client";

import { useEffect, useState } from "react";
import type { CommercialPackage } from "@/types/commercial-package";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type {
  OpportunityDiscoveryQuestionItem,
  OpportunityUnderstanding,
} from "@/lib/opportunity-workspace-intelligence";
import { OpportunitySmartAssistActions } from "@/components/opportunity/opportunity-smartassist-actions";
import {
  EDITORIAL_BODY,
  EDITORIAL_CONTENT,
  EDITORIAL_DIVIDER,
  EDITORIAL_EMPTY,
  EDITORIAL_GAP_LIST,
  EDITORIAL_GAP_PAGE,
  EDITORIAL_LABEL,
} from "@/lib/editorial-design-system";

export function OpportunityQuestionsWorkspace({
  pipeline,
  companies,
  commercialPackages,
  understanding,
  questions,
  onSaveAnswer,
}: {
  pipeline: PipelineRow;
  companies: Company[];
  commercialPackages: CommercialPackage[];
  understanding: OpportunityUnderstanding;
  questions: OpportunityDiscoveryQuestionItem[];
  onSaveAnswer?: (
    item: OpportunityDiscoveryQuestionItem,
    value: string,
  ) => Promise<void>;
}) {
  return (
    <div className={`flex ${EDITORIAL_CONTENT} flex-col ${EDITORIAL_GAP_PAGE}`}>
      <OpportunitySmartAssistActions
        pipeline={pipeline}
        companies={companies}
        commercialPackages={commercialPackages}
        understanding={understanding}
        activities={[]}
        actions={["email", "meeting"]}
      />

      <div className={`${EDITORIAL_DIVIDER} pt-8`}>
        <p className={EDITORIAL_LABEL}>Discovery questions</p>
        <p className="mt-1 text-[13px] text-carbon-blue/55">
          Capture answers from customer conversations. Answers update opportunity
          understanding and close gaps automatically.
        </p>
        {questions.length === 0 ? (
          <p className={`mt-4 ${EDITORIAL_EMPTY}`}>No discovery questions suggested yet.</p>
        ) : (
          <ul className={`mt-4 ${EDITORIAL_GAP_LIST} space-y-5`}>
            {questions.map((item) => (
              <DiscoveryAnswerRow
                key={item.id}
                pipeline={pipeline}
                item={item}
                onSaveAnswer={onSaveAnswer}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function initialAnswer(
  pipeline: PipelineRow,
  item: OpportunityDiscoveryQuestionItem,
): string {
  if (item.fieldId) {
    return pipeline.understanding?.fields?.[item.fieldId]?.trim() ?? "";
  }
  return pipeline.understanding?.discoveryNotes?.[item.id]?.trim() ?? "";
}

function DiscoveryAnswerRow({
  pipeline,
  item,
  onSaveAnswer,
}: {
  pipeline: PipelineRow;
  item: OpportunityDiscoveryQuestionItem;
  onSaveAnswer?: (
    item: OpportunityDiscoveryQuestionItem,
    value: string,
  ) => Promise<void>;
}) {
  const [draft, setDraft] = useState(() => initialAnswer(pipeline, item));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    setDraft(initialAnswer(pipeline, item));
  }, [pipeline, item]);

  const savedValue = initialAnswer(pipeline, item);
  const dirty = draft.trim() !== savedValue;
  const readOnly = !onSaveAnswer;

  const onSave = async () => {
    if (!onSaveAnswer) return;
    setSaving(true);
    setError(null);
    try {
      await onSaveAnswer(item, draft.trim());
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save answer");
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="border-b border-carbon-blue/8 pb-5 last:border-b-0 last:pb-0">
      <p className={`${EDITORIAL_BODY} text-carbon-blue/80`}>{item.question}</p>
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        rows={3}
        disabled={readOnly}
        placeholder="Type the answer from your discovery conversation…"
        className="mt-2 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[13px] text-carbon-blue/80 placeholder:text-carbon-blue/35 disabled:bg-carbon-blue/[0.02]"
      />
      {!readOnly ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={saving || !dirty}
            onClick={() => void onSave()}
            className="border border-upcycle-orange bg-upcycle-orange px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-45"
          >
            {saving ? "Saving…" : savedValue ? "Update answer" : "Save answer"}
          </button>
          {savedFlash ? (
            <span className="text-[11px] font-medium text-emerald-700">Saved</span>
          ) : null}
          {item.fieldId ? (
            <span className="text-[10px] text-carbon-blue/40">
              Saves to understanding · {item.fieldId.replace(/_/g, " ")}
            </span>
          ) : null}
          {error ? <span className="text-[11px] text-thermal-red">{error}</span> : null}
        </div>
      ) : null}
    </li>
  );
}
