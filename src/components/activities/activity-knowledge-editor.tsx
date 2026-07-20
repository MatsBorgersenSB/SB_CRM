"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Bot, Pencil, Save } from "lucide-react";
import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import { ActivityKnowledgeCapturePanel } from "@/components/activities/activity-knowledge-capture-panel";
import { ActivityKnowledgeSections } from "@/components/activities/activity-knowledge-sections";
import { syncActivityUpdate } from "@/lib/sync-activity";
import {
  parseAgreedActions,
  parseMemoryLines,
} from "@/lib/relationship-memory";

type ActivityKnowledgeEditorProps = {
  activity: Activity;
  companies: Company[];
  pipelines: PipelineRow[];
  allActivities?: Activity[];
  renderReadView?: (props: { onEdit: () => void }) => ReactNode;
};

export function ActivityKnowledgeEditor({
  activity,
  companies,
  pipelines,
  allActivities = [],
  defaultEditing = false,
  renderReadView,
}: ActivityKnowledgeEditorProps & { defaultEditing?: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(defaultEditing);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState(activity.Summary ?? "");
  const [notes, setNotes] = useState(activity.ActivityDescription ?? "");
  const [keyDecisionsText, setKeyDecisionsText] = useState(
    (activity.KeyDecisions ?? []).join("\n"),
  );
  const [agreedActionsText, setAgreedActionsText] = useState(
    (activity.AgreedActions ?? [])
      .map((a) => (a.dueDate ? `${a.text} | ${a.dueDate}` : a.text))
      .join("\n"),
  );
  const [risksText, setRisksText] = useState((activity.Risks ?? []).join("\n"));
  const [nextAction, setNextAction] = useState(activity.NextAction ?? "");
  const [dueDate, setDueDate] = useState(activity.NextActionDate ?? "");
  const [followUp, setFollowUp] = useState(activity.ActionRequired);
  const [assessment, setAssessment] = useState(activity.SmartAssistAssessment ?? null);

  const company = companies.find((c) => c.Title === activity.Company?.Title);
  const deal = pipelines.find((p) => p.id === activity.Deal?.Title);

  const handleSave = async () => {
    setSaving(true);
    try {
      await syncActivityUpdate(activity.ActivityID, {
        Summary: summary.trim(),
        ActivityDescription: notes.trim(),
        KeyDecisions: parseMemoryLines(keyDecisionsText),
        AgreedActions: parseAgreedActions(agreedActionsText),
        Risks: parseMemoryLines(risksText),
        NextAction: followUp ? nextAction.trim() : "",
        NextActionDate: followUp ? dueDate : "",
        ActionRequired: followUp,
        SmartAssistAssessment: assessment ?? undefined,
      });
      setEditing(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    if (renderReadView) {
      return renderReadView({ onEdit: () => setEditing(true) });
    }

    return (
      <div>
        <div className="mb-4 flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            Structured knowledge object
          </p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1 rounded-md border border-carbon-blue/12 px-2.5 py-1 text-[10px] font-semibold text-carbon-blue/60 hover:bg-carbon-blue/[0.03]"
          >
            <Pencil className="size-3" strokeWidth={2} />
            Edit knowledge
          </button>
        </div>
        <ActivityKnowledgeSections activity={activity} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ActivityKnowledgeCapturePanel
        activityType={activity.ActivityType}
        subject={activity.Subject}
        company={company}
        deal={deal}
        contactName={activity.Contact?.Title}
        existingNotes={notes}
        onApply={(state) => {
          setSummary(state.summary);
          setNotes(state.notes);
          setKeyDecisionsText(state.keyDecisionsText);
          setAgreedActionsText(state.agreedActionsText);
          setRisksText(state.risksText);
          setNextAction(state.nextAction);
          setDueDate(state.dueDate);
          setFollowUp(state.followUp);
          setAssessment(state.assessment);
        }}
      />

      <div className="dashboard-card space-y-3 p-5">
        <Field label="Summary" value={summary} onChange={setSummary} />
        <Field label="What happened" value={notes} onChange={setNotes} multiline />
        <Field label="Decisions" value={keyDecisionsText} onChange={setKeyDecisionsText} multiline />
        <Field
          label="Commitments (text | due date)"
          value={agreedActionsText}
          onChange={setAgreedActionsText}
          multiline
        />
        <Field label="Risks" value={risksText} onChange={setRisksText} multiline />
        <label className="flex items-center gap-2 text-sm text-carbon-blue">
          <input
            type="checkbox"
            checked={followUp}
            onChange={(e) => setFollowUp(e.target.checked)}
            className="accent-upcycle-orange"
          />
          Follow-up required
        </label>
        {followUp ? (
          <>
            <Field label="What happens next" value={nextAction} onChange={setNextAction} />
            <Field label="Due date" value={dueDate} onChange={setDueDate} type="date" />
          </>
        ) : null}
        {assessment ? (
          <div className="rounded-md border border-upcycle-orange/20 bg-upcycle-orange/[0.03] p-3">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-upcycle-orange">
              <Bot className="size-3" />
              SmartAssist Assessment
            </p>
            <p className="mt-1 text-xs text-carbon-blue/60">{assessment.summary}</p>
          </div>
        ) : null}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
          className="inline-flex items-center gap-1 rounded-md bg-upcycle-orange px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
        >
          <Save className="size-3.5" />
          {saving ? "Saving…" : "Save knowledge"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rounded-md border border-carbon-blue/12 px-3 py-1.5 text-[11px] font-semibold text-carbon-blue/55"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline = false,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
        {label}
      </span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="mt-1 w-full resize-none border border-carbon-blue/12 px-3 py-2 text-sm text-carbon-blue outline-none focus:border-upcycle-orange/40"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 w-full border border-carbon-blue/12 px-3 py-2 text-sm text-carbon-blue outline-none focus:border-upcycle-orange/40"
        />
      )}
    </label>
  );
}
