"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AUTH_ROLE_HEADER } from "@/lib/api-auth";
import { laterIso } from "@/lib/contact-360-verdict";
import { getContactDisplayName, type Contact } from "@/types/contact";
import type { UserRole } from "@/types/auth";
import type { SentimentGrade } from "@/generated/prisma";
import { SyncedMailPreview } from "@/components/emails/synced-mail-preview";
import { EmailMessageActions } from "@/components/emails/email-message-actions";
import { contact360Href, deal360Href, project360Href } from "@/types/relationship-navigation";

type CompanyEmailMessage = {
  id: string;
  conversationId: string;
  opportunityId: string | null;
  opportunityName: string | null;
  projectId: string | null;
  projectName: string | null;
  contactId: string | null;
  contactName: string | null;
  contactPhone: string | null;
  subject: string;
  bodyPreview: string | null;
  webLink?: string | null;
  senderEmail: string;
  recipientEmails: string[];
  sentAt: string;
  sentiment: SentimentGrade;
  isOutbound: boolean;
  isInternalOnly?: boolean;
  isDeletedInSource: boolean;
};

type CompanyEmailThread = {
  conversationId: string;
  summary: {
    subject: string;
    messageCount: number;
    latestSentAt: string;
  } | null;
  messages: CompanyEmailMessage[];
};

function formatSentAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unknown";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeEmail(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function messageTouchesContact(message: CompanyEmailMessage, contact: Contact): boolean {
  const email = normalizeEmail(contact.Email);
  if (!email) return false;
  if (normalizeEmail(message.senderEmail) === email) return true;
  return message.recipientEmails.some((address) => normalizeEmail(address) === email);
}

/**
 * Thin company-lens Outlook threads. Tagging stays on the person page.
 */
export function CompanyRecentOutlook({
  companyId,
  contacts,
  role,
  onLatestMailAt,
  onContactLastMail,
}: {
  companyId: string;
  contacts: Contact[];
  role: UserRole;
  onLatestMailAt?: (sentAt: string | null) => void;
  onContactLastMail?: (byContactId: Record<string, string>) => void;
}) {
  const [threads, setThreads] = useState<CompanyEmailThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [domainFilter, setDomainFilter] = useState<"all" | "external">("external");
  const latestMailRef = useRef<string | null>(null);
  const contactMailRef = useRef<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/companies/${encodeURIComponent(companyId)}/emails`,
        { headers: { [AUTH_ROLE_HEADER]: role } },
      );
      const payload = (await response.json()) as {
        error?: string;
        threads?: CompanyEmailThread[];
      };
      if (!response.ok) {
        throw new Error(payload.error || "Could not load Outlook mail.");
      }
      setThreads(payload.threads ?? []);
    } catch (err) {
      setThreads([]);
      setError(err instanceof Error ? err.message : "Could not load Outlook mail.");
    } finally {
      setLoading(false);
    }
  }, [companyId, role]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleThreads = useMemo(
    () =>
      threads
        .filter((thread) => {
          if (domainFilter !== "external") return true;
          return thread.messages.some((message) => !message.isInternalOnly);
        })
        .slice(0, 8),
    [threads, domainFilter],
  );

  const hasInternalMail = useMemo(
    () => threads.some((thread) => thread.messages.every((message) => message.isInternalOnly)),
    [threads],
  );

  useEffect(() => {
    const latest = visibleThreads[0]?.summary?.latestSentAt ?? visibleThreads[0]?.messages.at(-1)?.sentAt ?? null;
    if (latest === latestMailRef.current) return;
    latestMailRef.current = latest;
    onLatestMailAt?.(latest);
  }, [visibleThreads, onLatestMailAt]);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const contact of contacts) {
      let latest: string | null = null;
      for (const thread of threads) {
        for (const message of thread.messages) {
          if (!messageTouchesContact(message, contact)) continue;
          latest = laterIso(latest, message.sentAt);
        }
      }
      if (latest) next[contact.ContactID] = latest;
    }
    const serialized = JSON.stringify(next);
    if (serialized === contactMailRef.current) return;
    contactMailRef.current = serialized;
    onContactLastMail?.(next);
  }, [contacts, threads, onContactLastMail]);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
          Recent Outlook
        </p>
        <div className="flex items-center gap-2">
          {hasInternalMail ? (
            <select
              value={domainFilter}
              onChange={(event) =>
                setDomainFilter(event.target.value as "all" | "external")
              }
              className="border border-carbon-blue/15 bg-white px-2 py-1 text-[10px] text-carbon-blue"
              aria-label="Domain filter"
            >
              <option value="external">External (default)</option>
              <option value="all">All domains</option>
            </select>
          ) : null}
          <button
            type="button"
            onClick={() => void load()}
            className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45 hover:text-upcycle-orange"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-[12px] text-carbon-blue/45">Loading Outlook threads…</p>
      ) : null}
      {error ? <p className="text-[12px] text-red-700/80">{error}</p> : null}

      {!loading && !error && visibleThreads.length === 0 ? (
        <p className="text-[12px] leading-relaxed text-carbon-blue/55">
          No synced Outlook mail for this company yet. Save mail from Outlook, then refresh.
        </p>
      ) : null}

      <ul className="mt-2 flex flex-col gap-2">
        {visibleThreads.map((thread) => {
          const latest = thread.messages[thread.messages.length - 1]!;
          const subject =
            thread.summary?.subject ||
            latest.subject.replace(/^Re:\s*/i, "").trim() ||
            latest.subject;
          const matchedContact = contacts.find((contact) =>
            messageTouchesContact(latest, contact),
          );

          return (
            <li
              key={thread.conversationId}
              className="border border-carbon-blue/10 bg-carbon-blue/[0.02] px-3 py-2"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-[13px] font-semibold text-carbon-blue">{subject}</p>
                <p className="text-[10px] text-carbon-blue/45">
                  {formatSentAt(thread.summary?.latestSentAt ?? latest.sentAt)}
                </p>
              </div>
              <p className="mt-0.5 text-[11px] text-carbon-blue/50">
                {latest.isOutbound ? "Outbound" : "Inbound"} ·{" "}
                {thread.summary?.messageCount ?? thread.messages.length} message
                {(thread.summary?.messageCount ?? thread.messages.length) === 1 ? "" : "s"}
                {matchedContact ? (
                  <>
                    {" "}
                    ·{" "}
                    <Link
                      href={contact360Href(matchedContact.ContactID, companyId)}
                      className="font-medium text-upcycle-orange hover:underline"
                    >
                      {getContactDisplayName(matchedContact)}
                    </Link>
                  </>
                ) : latest.contactName ? (
                  <> · {latest.contactName}</>
                ) : null}
                {latest.opportunityId && latest.opportunityName ? (
                  <>
                    {" "}
                    ·{" "}
                    <Link
                      href={deal360Href(latest.opportunityId)}
                      className="font-medium text-upcycle-orange hover:underline"
                    >
                      {latest.opportunityName}
                    </Link>
                  </>
                ) : null}
                {latest.projectId && latest.projectName ? (
                  <>
                    {" "}
                    ·{" "}
                    <Link
                      href={project360Href(latest.projectId)}
                      className="font-medium text-upcycle-orange hover:underline"
                    >
                      {latest.projectName}
                    </Link>
                  </>
                ) : null}
              </p>
              <SyncedMailPreview
                emailId={latest.id}
                bodyPreview={latest.bodyPreview}
                webLink={latest.webLink}
                role={role}
                compact
              />
              {!latest.isDeletedInSource ? (
                <EmailMessageActions
                  compact
                  toEmail={
                    latest.isOutbound
                      ? latest.recipientEmails[0] ?? matchedContact?.Email ?? ""
                      : latest.senderEmail
                  }
                  subject={subject}
                  bodyPreview={latest.bodyPreview}
                  contactName={
                    matchedContact
                      ? getContactDisplayName(matchedContact)
                      : latest.contactName
                  }
                  contactPhone={
                    matchedContact?.Mobile ||
                    matchedContact?.Phone ||
                    latest.contactPhone ||
                    undefined
                  }
                  role={role}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
