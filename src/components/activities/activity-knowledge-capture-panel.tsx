"use client";

import { useState } from "react";
import { Bot, Sparkles } from "lucide-react";
import type { ActivityType } from "@/types/activity";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type { ActivityKnowledgeDraft } from "@/types/activity-knowledge";
import { generateActivityKnowledgeDraft } from "@/lib/activity-knowledge-engine";

export type KnowledgeCaptureFormState = {
  summary: string;
  notes: string;
  keyDecisionsText: string;
  agreedActionsText: string;
  risksText: string;
  nextAction: string;
  dueDate: string;
  followUp: boolean;
  assessment: ActivityKnowledgeDraft["assessment"] | null;
};

type ActivityKnowledgeCapturePanelProps = {
  activityType: ActivityType | "";
  subject: string;
  company?: Company;
  deal?: PipelineRow;
  contactName?: string;
  existingNotes?: string;
  onApply: (state: KnowledgeCaptureFormState) => void;
};

function agreedActionsToText(commitments: ActivityKnowledgeDraft["commitments"]): string {
  return commitments
    .map((c) => (c.dueDate ? `${c.text} | ${c.dueDate}` : c.text))
    .join("\n");
}

export function ActivityKnowledgeCapturePanel({
  activityType,
  subject,
  company,
  deal,
  contactName,
  existingNotes,
  onApply,
}: ActivityKnowledgeCapturePanelProps) {
  const [generating, setGenerating] = useState(false);
  const [lastDraft, setLastDraft] = useState<ActivityKnowledgeDraft | null>(null);

  const handleGenerate = () => {
    if (!activityType) return;
    setGenerating(true);
    try {
      const draft = generateActivityKnowledgeDraft({
        activityType,
        subject,
        company,
        deal,
        contactName,
        existingDescription: existingNotes,
      });
      setLastDraft(draft);
      onApply({
        summary: draft.summary,
        notes: draft.whatHappened,
        keyDecisionsText: draft.decisions.join("\n"),
        agreedActionsText: agreedActionsToText(draft.commitments),
        risksText: draft.risks.join("\n"),
        nextAction: draft.whatHappensNext,
        dueDate: draft.whatHappensNextDue ?? "",
        followUp: Boolean(draft.whatHappensNext),
        assessment: draft.assessment,
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="rounded-lg border border-upcycle-orange/25 bg-upcycle-orange/[0.04] p-3">
      <div className="flex items-start gap-2">
        <Bot className="mt-0.5 size-4 shrink-0 text-upcycle-orange" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-upcycle-orange">
            SmartAssist Knowledge Capture
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-carbon-blue/60">
            SmartAssist drafts structured knowledge — what happened, agreements, decisions,
            commitments, risks, and next steps. Review and approve before saving.
          </p>
          <button
            type="button"
            disabled={!activityType || generating}
            onClick={handleGenerate}
            className="mt-2.5 inline-flex items-center gap-1.5 rounded-md bg-upcycle-orange px-3 py-1.5 text-[11px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Sparkles className="size-3.5" strokeWidth={2} />
            {generating ? "Generating…" : "Generate knowledge draft"}
          </button>
          {lastDraft ? (
            <p className="mt-2 text-[10px] text-carbon-blue/45">
              Draft ready — {lastDraft.assessment.completenessScore}% complete ·{" "}
              {lastDraft.decisions.length} decisions · {lastDraft.commitments.length} commitments
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
