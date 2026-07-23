"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { useEscapeKey } from "@/hooks/use-escape-key";
import { AUTH_ROLE_HEADER } from "@/lib/api-auth";
import { useAuth } from "@/context/auth-context";
import type { EmailDraftTone } from "@/lib/ai/email-copilot";
import { DraftInOutlookButton } from "@/components/opportunities/draft-in-outlook-button";

type DraftPayload = {
  subject: string;
  body: string;
  confidenceScore: number;
  tone: EmailDraftTone;
  rationale: string;
};

export type GenerateAiDraftContext = {
  contactName: string;
  contactEmail?: string | null;
  companyName?: string | null;
  dealStage?: string | null;
  dealId?: string | null;
  contactId?: string | null;
  context?: string;
  objective?: string | null;
};

const TONES: EmailDraftTone[] = ["professional", "warm", "direct", "formal"];

/**
 * FS-012 — Generate AI Draft button + slide-over drawer for Contact/Deal activity tabs.
 */
export function GenerateAiDraftControl({
  draftContext,
  className = "",
}: {
  draftContext: GenerateAiDraftContext;
  className?: string;
}) {
  const { user } = useAuth();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [tone, setTone] = useState<EmailDraftTone>("professional");
  const [contextText, setContextText] = useState(draftContext.context ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftPayload | null>(null);

  const close = useCallback(() => setOpen(false), []);
  useEscapeKey(open, close);

  useEffect(() => {
    if (!open) return;
    setContextText(draftContext.context ?? "");
    setDraft(null);
    setError(null);
  }, [open, draftContext.context]);

  const generate = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/ai/email-draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [AUTH_ROLE_HEADER]: user.role,
        },
        body: JSON.stringify({
          context: contextText,
          contactName: draftContext.contactName,
          dealStage: draftContext.dealStage,
          tone,
          companyName: draftContext.companyName,
          objective: draftContext.objective,
          entityType: draftContext.dealId ? "Deal" : "Contact",
          entityId: draftContext.dealId || draftContext.contactId || draftContext.contactName,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        draft?: DraftPayload;
        error?: string;
      };
      if (!response.ok || !payload.draft) {
        throw new Error(payload.error || "Could not generate draft");
      }
      setDraft(payload.draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Draft generation failed");
    } finally {
      setBusy(false);
    }
  }, [contextText, draftContext, tone, user.role]);

  if (user.role === "client_lead") return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ||
          "inline-flex shrink-0 items-center justify-center gap-1.5 border border-carbon-blue/15 bg-white px-3 py-2 text-xs font-semibold text-carbon-blue transition-colors hover:border-upcycle-orange/40 hover:text-upcycle-orange"
        }
      >
        <Sparkles className="size-3.5" strokeWidth={2} />
        Generate AI Draft
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-carbon-blue/30 backdrop-blur-[1px]">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close draft drawer"
            onClick={close}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative flex h-full w-full max-w-md flex-col border-l border-carbon-blue/15 bg-white shadow-xl"
          >
            <header className="flex items-start justify-between gap-3 border-b border-carbon-blue/10 px-4 py-3">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                  FS-012 · Email Copilot
                </p>
                <h2 id={titleId} className="mt-0.5 text-sm font-semibold text-carbon-blue">
                  Generate AI Draft
                </h2>
                <p className="mt-0.5 text-[11px] text-carbon-blue/55">
                  For {draftContext.contactName}
                  {draftContext.companyName ? ` · ${draftContext.companyName}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                className="rounded border border-transparent p-1 text-carbon-blue/50 hover:border-carbon-blue/15 hover:text-carbon-blue"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </header>

            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
              <label className="block">
                <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                  Tone
                </span>
                <select
                  value={tone}
                  onChange={(event) => setTone(event.target.value as EmailDraftTone)}
                  className="mt-1 w-full border border-carbon-blue/15 bg-white px-2 py-1.5 text-[12px] text-carbon-blue outline-none focus:border-upcycle-orange"
                >
                  {TONES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                  Known context
                </span>
                <textarea
                  value={contextText}
                  onChange={(event) => setContextText(event.target.value)}
                  rows={5}
                  placeholder="What do we already know? Prior conversation, open ask, deal status…"
                  className="mt-1 w-full resize-y border border-carbon-blue/15 bg-white px-2 py-1.5 text-[12px] leading-relaxed text-carbon-blue outline-none focus:border-upcycle-orange"
                />
              </label>

              <button
                type="button"
                disabled={busy}
                onClick={() => void generate()}
                className="w-full border border-upcycle-orange bg-upcycle-orange px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-white hover:brightness-105 disabled:opacity-50"
              >
                {busy ? "Generating…" : "Generate draft"}
              </button>

              {error ? <p className="text-[11px] text-thermal-red">{error}</p> : null}

              {draft ? (
                <div className="space-y-3 border-t border-carbon-blue/10 pt-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                      Draft
                    </p>
                    <span className="text-[10px] font-semibold text-carbon-blue/60">
                      Confidence {draft.confidenceScore}%
                    </span>
                  </div>
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                      Subject
                    </p>
                    <p className="mt-0.5 text-[12px] font-semibold text-carbon-blue">
                      {draft.subject}
                    </p>
                  </div>
                  <pre className="whitespace-pre-wrap border border-carbon-blue/10 bg-carbon-blue/[0.02] p-3 font-sans text-[12px] leading-relaxed text-carbon-blue/85">
                    {draft.body}
                  </pre>
                  <p className="text-[10px] text-carbon-blue/45">{draft.rationale}</p>
                  {draftContext.contactEmail ? (
                    <DraftInOutlookButton
                      toEmail={draftContext.contactEmail}
                      subject={draft.subject}
                      bodyHtml={draft.body.replace(/\n/g, "<br/>")}
                      opportunityId={draftContext.dealId ?? undefined}
                      role={user.role}
                      label="Open in Outlook"
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
