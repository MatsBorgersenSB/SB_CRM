"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  appendDiscoveryAnswer,
  createWorkspaceArchitectSession,
  getCurrentDiscoveryQuestion,
} from "@/lib/workspace-architect-engine";
import {
  clearWorkspaceArchitectSession,
  readWorkspaceArchitectSession,
  writeWorkspaceArchitectSession,
} from "@/lib/workspace-architect-state";
import { WORKSPACE_ARCHITECT } from "@/lib/smart-assist-config";
import type { WorkspaceArchitectSession } from "@/types/workspace-architect";
import { WORKSPACE_DISCOVERY_QUESTIONS } from "@/types/workspace-architect";
import { WorkspaceDesignPreviewPanel } from "@/components/administration/workspace-design-preview-panel";

export function WorkspaceArchitectConversation({
  onDesignReady,
}: {
  onDesignReady: (session: WorkspaceArchitectSession) => void;
}) {
  const [session, setSession] = useState<WorkspaceArchitectSession | null>(null);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = readWorkspaceArchitectSession();
    setSession(stored ?? createWorkspaceArchitectSession());
  }, []);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [session?.messages.length, session?.design]);

  const currentQuestion = session ? getCurrentDiscoveryQuestion(session) : null;

  const persistSession = useCallback((next: WorkspaceArchitectSession) => {
    setSession(next);
    writeWorkspaceArchitectSession(next);
  }, []);

  const handleSubmit = async () => {
    if (!session || !draft.trim() || submitting) return;

    setSubmitting(true);
    setError(null);

    const answered = appendDiscoveryAnswer(session, draft);
    setDraft("");

    if (!answered.complete) {
      persistSession(answered);
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch("/api/administration/workspace-architect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session: answered }),
      });

      if (!response.ok) {
        throw new Error("Could not generate workspace design.");
      }

      const body = (await response.json()) as { session: WorkspaceArchitectSession };
      persistSession(body.session);
      onDesignReady(body.session);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Something went wrong.");
      persistSession(answered);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestart = () => {
    clearWorkspaceArchitectSession();
    const fresh = createWorkspaceArchitectSession();
    persistSession(fresh);
    setDraft("");
    setError(null);
  };

  if (!session) {
    return <p className="text-sm text-carbon-blue/45">Starting conversation…</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        ref={scrollRef}
        className="max-h-[420px] space-y-3 overflow-y-auto border border-carbon-blue/10 bg-carbon-blue/[0.02] p-4"
      >
        {session.messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] px-3 py-2.5 text-[13px] leading-relaxed ${
                message.role === "user"
                  ? "border border-upcycle-orange/20 bg-upcycle-orange/10 text-carbon-blue"
                  : "border border-carbon-blue/10 bg-white text-carbon-blue/80"
              }`}
            >
              {message.role === "assistant" ? (
                <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-upcycle-orange">
                  SmartAssist
                </p>
              ) : null}
              {message.content}
            </div>
          </div>
        ))}
      </div>

      {session.design ? (
        <WorkspaceDesignPreviewPanel design={session.design} />
      ) : null}

      {!session.complete ? (
        <div className="border border-carbon-blue/10 bg-white p-4">
          {currentQuestion?.helper ? (
            <p className="mb-2 text-[11px] text-carbon-blue/50">{currentQuestion.helper}</p>
          ) : null}
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={currentQuestion?.placeholder ?? "Your answer…"}
            rows={3}
            className="w-full resize-y border border-carbon-blue/15 px-3 py-2 text-sm text-carbon-blue outline-none focus:border-upcycle-orange/40"
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void handleSubmit();
              }
            }}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!draft.trim() || submitting}
              onClick={() => void handleSubmit()}
              className="border border-upcycle-orange bg-upcycle-orange px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Thinking…" : "Continue"}
            </button>
            <button
              type="button"
              onClick={handleRestart}
              className="border border-carbon-blue/15 px-3 py-1.5 text-[11px] font-semibold text-carbon-blue/55 hover:text-carbon-blue"
            >
              Start over
            </button>
            <span className="text-[10px] text-carbon-blue/40">
              {session.currentQuestionIndex + 1} of {WORKSPACE_DISCOVERY_QUESTIONS.length}
            </span>
          </div>
          {error ? <p className="mt-2 text-[12px] text-thermal-red">{error}</p> : null}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleRestart}
            className="border border-carbon-blue/15 px-3 py-1.5 text-[11px] font-semibold text-carbon-blue/60 hover:text-carbon-blue"
          >
            Start new conversation
          </button>
        </div>
      )}
    </div>
  );
}
