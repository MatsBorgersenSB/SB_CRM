"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AUTH_ROLE_HEADER } from "@/lib/api-auth";
import {
  analyzeOpportunityMail,
  type MailTodo,
  type MissingFieldInput,
} from "@/lib/mail-todo-detection";
import type { CorrespondenceMailSnippet } from "@/lib/correspondence-action-signals";
import type { EmailThreadPayload } from "@/components/opportunities/email-intelligence";
import type { UserRole } from "@/types/auth";
import {
  EDITORIAL_BODY_MUTED,
  EDITORIAL_LABEL,
} from "@/lib/editorial-design-system";

const RECHECK_MS = 5 * 60 * 1000;

function ageLabel(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function TodoList({
  title,
  items,
}: {
  title: string;
  items: MailTodo[];
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className={EDITORIAL_LABEL}>{title}</p>
      <ul className="mt-1.5 space-y-1.5">
        {items.map((item) => (
          <li key={item.id} className="text-[14px] leading-snug text-carbon-blue/85">
            {item.text}
            <span className="ml-1.5 text-[12px] text-carbon-blue/50">
              · {ageLabel(item.daysSince)} · {item.subject}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * SmartAssist mail check — always reads the mail linked to this opportunity and says what
 * we owe the client, what the client owes us, and what is still missing.
 */
export function OpportunityMailSignals({
  opportunityId,
  role,
  missingFields,
  onConfirmField,
  onOpenEmails,
}: {
  opportunityId: string;
  role: UserRole;
  missingFields: MissingFieldInput[];
  onConfirmField?: (fieldId: string, value: string) => Promise<void>;
  onOpenEmails?: () => void;
}) {
  const [messages, setMessages] = useState<CorrespondenceMailSnippet[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<ReadonlySet<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/opportunities/${encodeURIComponent(opportunityId)}/emails`,
        { headers: { [AUTH_ROLE_HEADER]: role }, cache: "no-store" },
      );
      if (!response.ok) throw new Error("mail unavailable");
      const payload = (await response.json()) as { threads?: EmailThreadPayload[] };
      const snippets = (payload.threads ?? [])
        .flatMap((thread) => thread.messages)
        // Privacy First: internal-only mail is not client correspondence.
        .filter((message) => !message.isInternalOnly)
        .map<CorrespondenceMailSnippet>((message) => ({
          id: message.id,
          conversationId: message.conversationId,
          subject: message.subject,
          bodyPreview: message.bodyPreview,
          sentAt: message.sentAt,
          isOutbound: message.isOutbound,
        }));
      setMessages(snippets);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [opportunityId, role]);

  // Always check: on open, when the tab regains focus, and every few minutes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load on open, then keep re-checking
    void load();
    const timer = window.setInterval(() => void load(), RECHECK_MS);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  const analysis = useMemo(
    () => (messages ? analyzeOpportunityMail(messages, missingFields) : null),
    [messages, missingFields],
  );

  if (failed && !analysis) return null;
  if (!analysis) {
    return (
      <div className="rounded-lg border border-slate-200/80 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <p className={EDITORIAL_LABEL}>From your mail</p>
        <p className={`mt-2 ${EDITORIAL_BODY_MUTED}`}>Checking mail…</p>
      </div>
    );
  }

  const suggestions = analysis.suggestions.filter((s) => !confirmed.has(s.fieldId));
  const nothingOpen =
    analysis.weOwe.length === 0 &&
    analysis.clientOwes.length === 0 &&
    suggestions.length === 0 &&
    analysis.askClient.length === 0;

  const confirm = async (fieldId: string, value: string) => {
    if (!onConfirmField) return;
    setSavingField(fieldId);
    try {
      await onConfirmField(fieldId, value);
      setConfirmed((current) => new Set(current).add(fieldId));
    } finally {
      setSavingField(null);
    }
  };

  return (
    <section
      aria-label="Mail check"
      className="rounded-lg border border-slate-200/80 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-950"
    >
      <div className="flex items-center justify-between gap-2">
        <p className={EDITORIAL_LABEL}>From your mail</p>
        {onOpenEmails ? (
          <button
            type="button"
            onClick={onOpenEmails}
            className="text-[12px] font-medium text-upcycle-orange hover:underline"
          >
            Open emails
          </button>
        ) : null}
      </div>

      {analysis.messageCount === 0 ? (
        <p className={`mt-2 ${EDITORIAL_BODY_MUTED}`}>
          No mail is linked to this opportunity yet — link the customer conversation in Outlook
          and SmartAssist will read it.
        </p>
      ) : nothingOpen ? (
        <p className={`mt-2 ${EDITORIAL_BODY_MUTED}`}>
          Mail checked ({analysis.messageCount}) — nothing open on either side.
        </p>
      ) : (
        <div className="mt-2.5 space-y-3">
          <TodoList title="We owe the client" items={analysis.weOwe} />
          <TodoList title="Waiting for the client" items={analysis.clientOwes} />

          {suggestions.length > 0 ? (
            <div>
              <p className={EDITORIAL_LABEL}>The client already told us</p>
              <ul className="mt-1.5 space-y-2">
                {suggestions.map((suggestion) => (
                  <li
                    key={suggestion.fieldId}
                    className="flex flex-wrap items-center justify-between gap-2 text-[14px] text-carbon-blue/85"
                  >
                    <span>
                      <span className="font-medium">{suggestion.label}:</span> “
                      {suggestion.excerpt}”
                    </span>
                    {onConfirmField ? (
                      <button
                        type="button"
                        disabled={savingField === suggestion.fieldId}
                        onClick={() => void confirm(suggestion.fieldId, suggestion.excerpt)}
                        className="rounded-md border border-upcycle-orange/30 bg-upcycle-orange/10 px-2.5 py-1 text-[12px] font-semibold text-upcycle-orange hover:bg-upcycle-orange/15 disabled:opacity-60"
                      >
                        {savingField === suggestion.fieldId ? "Saving…" : "Confirm"}
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {analysis.askClient.length > 0 ? (
            <div>
              <p className={EDITORIAL_LABEL}>Still missing — ask the client</p>
              <ul className="mt-1.5 space-y-1">
                {analysis.askClient.map((item) => (
                  <li key={item.fieldId} className="text-[14px] text-carbon-blue/85">
                    {item.label}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
