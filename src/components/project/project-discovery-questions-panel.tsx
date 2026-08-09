"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import {
  EDITORIAL_BODY,
  EDITORIAL_EMPTY,
  EDITORIAL_GAP_LIST,
  EDITORIAL_LABEL,
} from "@/lib/editorial-design-system";
import {
  PROJECT_QUESTION_FIELD_MAP,
  type ProjectDiscoveryQuestionItem,
} from "@/lib/project-discovery-intelligence";
import { syncProjectRecord } from "@/lib/sync-project";
import type { Project } from "@/types/project";

export function ProjectDiscoveryQuestionsPanel({
  projectId,
  project,
  questions,
  validations,
  conversations,
}: {
  projectId: string;
  project: Project;
  questions: ProjectDiscoveryQuestionItem[];
  validations: string[];
  conversations: string[];
}) {
  return (
    <div className="flex flex-col gap-10 py-1">
      <section>
        <p className={EDITORIAL_LABEL}>Questions to ask</p>
        <p className="mt-1 text-[13px] text-carbon-blue/55">
          Capture answers from discovery conversations. SmartAssist uses these to build
          understanding before recommending actions.
        </p>
        {questions.length === 0 ? (
          <p className={`mt-4 ${EDITORIAL_EMPTY}`}>
            No questions suggested yet — link an account and log a discovery conversation.
          </p>
        ) : (
          <ul className={`${EDITORIAL_GAP_LIST} mt-4 space-y-5`}>
            {questions.map((item) => (
              <DiscoveryAnswerRow
                key={item.id}
                projectId={projectId}
                project={project}
                item={item}
              />
            ))}
          </ul>
        )}
      </section>
      <DiscoveryList
        title="Validations"
        description="Confirm assumptions before generating objectives, risks, or recommendations."
        items={validations}
        emptyLabel="Validations will appear as gaps are identified."
      />
      <DiscoveryList
        title="Recommended conversations"
        description="Who to speak with next to close critical gaps."
        items={conversations}
        emptyLabel="Conversation angles unlock as stakeholder and account context is added."
      />
    </div>
  );
}

function initialAnswerForQuestion(project: Project, item: ProjectDiscoveryQuestionItem): string {
  const fromAnswers = project.discoveryAnswers?.[item.id]?.trim();
  if (fromAnswers) return fromAnswers;
  const field = PROJECT_QUESTION_FIELD_MAP[item.id];
  if (field) return project[field]?.trim() ?? "";
  return "";
}

function DiscoveryAnswerRow({
  projectId,
  project,
  item,
}: {
  projectId: string;
  project: Project;
  item: ProjectDiscoveryQuestionItem;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [draft, setDraft] = useState(() => initialAnswerForQuestion(project, item));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    setDraft(initialAnswerForQuestion(project, item));
  }, [project, item]);

  const savedValue = initialAnswerForQuestion(project, item);
  const dirty = draft.trim() !== savedValue;

  const onSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const answer = draft.trim();
      const field = PROJECT_QUESTION_FIELD_MAP[item.id];
      await syncProjectRecord(
        projectId,
        {
          discoveryAnswers: { [item.id]: answer },
          ...(field ? { [field]: answer } : {}),
        },
        user.role,
      );
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1500);
      router.refresh();
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
        placeholder="Type the answer from your discovery conversation…"
        className="mt-2 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[13px] text-carbon-blue/80 placeholder:text-carbon-blue/35"
      />
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
        {error ? <span className="text-[11px] text-thermal-red">{error}</span> : null}
      </div>
    </li>
  );
}

function DiscoveryList({
  title,
  description,
  items,
  emptyLabel,
}: {
  title: string;
  description: string;
  items: string[];
  emptyLabel: string;
}) {
  return (
    <section>
      <p className={EDITORIAL_LABEL}>{title}</p>
      <p className="mt-1 text-[13px] text-carbon-blue/55">{description}</p>
      {items.length === 0 ? (
        <p className={`mt-4 ${EDITORIAL_EMPTY}`}>{emptyLabel}</p>
      ) : (
        <ul className={`${EDITORIAL_GAP_LIST} mt-4`}>
          {items.map((entry) => (
            <li key={entry} className={`${EDITORIAL_BODY} text-carbon-blue/75`}>
              {entry}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
