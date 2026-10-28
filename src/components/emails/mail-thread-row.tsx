"use client";

import Link from "next/link";
import { ChevronDown, ExternalLink, Trash2 } from "lucide-react";
import { EmailMessageActions } from "@/components/emails/email-message-actions";
import {
  MailAttachmentBadge,
  summarizeMailAttachments,
} from "@/components/emails/mail-attachment-badge";
import type { MailDateSortOrder } from "@/components/emails/mail-smart-filters";
import { ThreadCorrespondencePreview } from "@/components/emails/thread-correspondence-preview";
import { formatDate } from "@/lib/regional-format-preference";
import { isInternalEmail } from "@/lib/domain-rules";
import type { EmailMessageIntelligenceDto } from "@/lib/email-intelligence-data";
import {
  mailOpportunityImpact,
  mailTopic,
  matchingOpportunityForTopic,
} from "@/lib/mail-opportunity-draft";
import { maskVerificationCodes, readableMailText } from "@/lib/mail-preview-text";
import { outlookComposeUrl } from "@/lib/outlook-compose-link";
import { canCreateOpportunity } from "@/lib/permissions";
import {
  classifyMailMessage,
  describeMailThreadStatus,
  leadMessageOf,
  type MailThread,
  type MailThreadTone,
} from "@/lib/mail-triage";
import { company360Href, companyMailHref } from "@/types/company-360";
import {
  contact360Href,
  deal360Href,
  project360Href,
} from "@/types/relationship-navigation";
import type { UserRole } from "@/types/auth";
import type { SharePointPerson } from "@/types/company";

export type MailLinkOption = {
  id: string;
  label: string;
  name: string;
  code: string | null;
  /** Company the deal belongs to — used to list this company's deals first. */
  companyId: string | null;
};

export type MailThreadLinks = {
  opportunityId?: string | null;
  projectId?: string | null;
};

type Thread = MailThread<EmailMessageIntelligenceDto>;

const TONE_CHIP: Record<MailThreadTone, string> = {
  alert: "border-thermal-red/35 bg-thermal-red/[0.08] text-thermal-red",
  attention: "border-upcycle-orange/40 bg-upcycle-orange/[0.08] text-upcycle-orange",
  quiet: "border-carbon-blue/15 bg-carbon-blue/[0.04] text-carbon-blue/60",
};

const TONE_EDGE: Record<MailThreadTone, string> = {
  alert: "border-l-thermal-red",
  attention: "border-l-upcycle-orange",
  quiet: "border-l-transparent",
};

function formatSent(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return formatDate(date);
}

function cleanSubject(subject: string): string {
  const stripped = maskVerificationCodes(
    subject.replace(/^((re|sv|fw|fwd|vs|vl)\s*:\s*)+/i, ""),
  ).trim();
  return stripped || subject.trim() || "(no subject)";
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** The outside party to write to — never our own address. */
function replyTarget(message: EmailMessageIntelligenceDto): string {
  if (!message.isOutbound) return message.senderEmail;
  return (
    message.recipientEmails.find((address) => !isInternalEmail(address)) ??
    message.recipientEmails[0] ??
    ""
  );
}

const FIELD_CLASS =
  "mt-0.5 w-full border border-carbon-blue/15 bg-white px-2 py-1 text-[12px] text-carbon-blue disabled:opacity-50";
const LABEL_CLASS =
  "text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/60";

function WorkSelect({
  label,
  value,
  fallbackLabel,
  options,
  companyId,
  disabled,
  onChange,
}: {
  label: string;
  value: string | null;
  fallbackLabel: string | null;
  options: MailLinkOption[];
  companyId: string | null;
  disabled: boolean;
  onChange: (id: string | null) => void;
}) {
  const sameCompany = companyId
    ? options.filter((option) => option.companyId === companyId)
    : [];
  const rest = options.filter((option) => !sameCompany.includes(option));
  const known = value ? options.some((option) => option.id === value) : true;
  return (
    <label className="block min-w-0">
      <span className={LABEL_CLASS}>{label}</span>
      <select
        value={value ?? ""}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value || null)}
        className={FIELD_CLASS}
      >
        <option value="">Not linked</option>
        {!known && value ? <option value={value}>{fallbackLabel ?? value}</option> : null}
        {sameCompany.length > 0 ? (
          <optgroup label="This company">
            {sameCompany.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </optgroup>
        ) : null}
        {rest.length > 0 ? (
          <optgroup label={sameCompany.length > 0 ? "Other open work" : "Open work"}>
            {rest.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </optgroup>
        ) : null}
      </select>
    </label>
  );
}

export function MailThreadRow({
  thread,
  role,
  expanded,
  busy,
  dateSort,
  opportunityOptions,
  projectOptions,
  assignableOptions = [],
  onToggle,
  onLink,
  onRemove,
  onCreateActivity,
  onAssignColleague,
  onFileAttachments,
  onHandled,
}: {
  thread: Thread;
  role: UserRole;
  expanded: boolean;
  busy: boolean;
  dateSort: MailDateSortOrder;
  opportunityOptions: MailLinkOption[];
  projectOptions: MailLinkOption[];
  assignableOptions?: SharePointPerson[];
  onToggle: () => void;
  onLink: (thread: Thread, contactId: string | null, links: MailThreadLinks) => void;
  onRemove: (thread: Thread, contactId: string | null) => void;
  onCreateActivity: (thread: Thread) => void;
  onAssignColleague?: (thread: Thread, assignee: SharePointPerson) => void;
  onFileAttachments?: (thread: Thread) => void;
  /** Mark "no reply needed" — the ask stays quiet until something new arrives. */
  onHandled: (thread: Thread) => void;
}) {
  const lead = leadMessageOf(thread.messages);
  if (!lead) return null;

  const withContact = thread.messages.find((message) => message.contactId);
  const contactId = withContact?.contactId ?? null;
  const contactName = withContact?.contactName ?? null;
  const contactPhone = withContact?.contactPhone ?? null;
  const companyUuid = withContact?.companyId ?? null;
  const companyKey = withContact?.companyCode ?? companyUuid;
  const companyName = withContact?.companyName ?? null;
  const dealMessage = thread.messages.find((message) => message.opportunityId);
  const projectMessage = thread.messages.find((message) => message.projectId);
  const dealId = dealMessage?.opportunityId ?? null;
  const projectId = projectMessage?.projectId ?? null;

  const humanMessages = thread.messages.filter(
    (message) => !message.isDeletedInSource && classifyMailMessage(message) === "human",
  );
  const isSystemOnly = humanMessages.length === 0;
  // Repeated identical bounces collapse to the latest one; a live bounce stays visible.
  const latestFailure =
    thread.status.kind === "delivery_failed"
      ? (thread.messages.find(
          (message) =>
            !message.isDeletedInSource && classifyMailMessage(message) === "delivery_failure",
        ) ?? null)
      : null;
  const baseReaderMessages = humanMessages.length > 0 ? humanMessages : thread.messages;
  const readerMessages = [
    ...baseReaderMessages.filter((message) => classifyMailMessage(message) !== "delivery_failure"),
    ...(latestFailure ? [latestFailure] : []),
  ];

  const copy = describeMailThreadStatus(thread.status, contactName);
  const tone: MailThreadTone = copy?.tone ?? "quiet";
  const bouncedSubject =
    thread.status.kind === "delivery_failed" ? thread.status.originalSubject : null;
  const subject = cleanSubject(bouncedSubject ?? lead.subject);
  const needsAnswerStatus =
    thread.status.kind === "reply_needed" || thread.status.kind === "waiting_on_them";
  const snippet = isSystemOnly ? "" : clip(readableMailText(lead.bodyPreview), 170);
  const lastFrom = lead.isOutbound ? "You" : contactName || lead.senderEmail;
  const messageCount = humanMessages.length || thread.messages.length;
  const target = replyTarget(lead);
  // A reply would go to the address that just bounced; the bounce status offers Resend instead.
  const bounced = thread.status.kind === "delivery_failed";
  const canReply =
    !isSystemOnly && Boolean(target) && !lead.isDeletedInSource && !bounced;

  // Resend goes to an address the contact carries now, never the failed one.
  const failedAddress =
    thread.status.kind === "delivery_failed" ? thread.status.failedAddress : null;
  const resendTo =
    thread.status.kind === "delivery_failed" &&
    thread.status.addressCorrected &&
    thread.status.bouncedMail === "mail"
      ? ((withContact?.contactEmails ?? []).find((address) => address.toLowerCase() !== failedAddress) ??
        null)
      : null;

  // Opportunity: only for sell-to companies. A matching deal is offered before a new one.
  const topic = mailTopic(lead.subject);
  const sameCompanyDeals = companyUuid
    ? opportunityOptions.filter((option) => option.companyId === companyUuid)
    : [];
  const matchingDeal = matchingOpportunityForTopic(
    sameCompanyDeals.map((option) => ({ id: option.id, assetName: option.name })),
    topic,
  );
  const offerOpportunity =
    !dealId &&
    !isSystemOnly &&
    !bounced &&
    Boolean(companyKey) &&
    withContact?.companySellTo === true &&
    canCreateOpportunity(role);

  const attachmentSummary = summarizeMailAttachments(thread.messages);
  const hasUnfiledAttachments =
    attachmentSummary.kind === "unfiled" || attachmentSummary.kind === "incomplete";
  const canFileAttachments =
    hasUnfiledAttachments &&
    !lead.isDeletedInSource &&
    Boolean(companyUuid || dealId || projectId) &&
    Boolean(onFileAttachments);

  return (
    <li
      id={`mail-${lead.id}`}
      className={`border-l-2 px-5 py-3 text-[13px] ${TONE_EDGE[tone]} ${
        expanded ? "bg-carbon-blue/[0.02]" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          aria-expanded={expanded}
          onClick={onToggle}
          className="min-w-0 flex-1 text-left"
        >
          <span className="flex flex-wrap items-center gap-2">
            {copy ? (
              <span
                className={`inline-flex items-center border px-1.5 py-0.5 text-[11px] font-semibold ${TONE_CHIP[copy.tone]}`}
              >
                {copy.label}
              </span>
            ) : null}
            <span
              className={`min-w-0 truncate font-semibold ${
                isSystemOnly ? "text-carbon-blue/60" : "text-carbon-blue"
              }`}
            >
              {subject}
            </span>
            <MailAttachmentBadge messages={thread.messages} />
          </span>
          <span className="mt-0.5 block text-[12px] text-carbon-blue/55">
            {isSystemOnly ? "Last" : `Last mail from ${lastFrom}`} · {formatSent(lead.sentAt)}
            {messageCount > 1 ? ` · ${messageCount} messages` : ""}
          </span>
          {snippet ? (
            <span className="mt-0.5 line-clamp-1 block text-[12px] text-carbon-blue/50">
              {snippet}
            </span>
          ) : null}
        </button>

        <div className="flex shrink-0 items-center gap-2">
          {resendTo ? (
            <a
              href={outlookComposeUrl({ to: resendTo, subject })}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center border border-upcycle-orange bg-upcycle-orange px-2.5 py-1 text-[12px] font-semibold text-white hover:opacity-90"
            >
              Resend
            </a>
          ) : thread.status.kind === "delivery_failed" && contactId ? (
            <Link
              href={contact360Href(contactId, companyKey ?? undefined)}
              className="inline-flex items-center border border-carbon-blue/25 bg-white px-2.5 py-1 text-[12px] font-semibold text-carbon-blue hover:border-upcycle-orange hover:text-upcycle-orange"
            >
              Check contact
            </Link>
          ) : needsAnswerStatus && canReply && !expanded ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => onHandled(thread)}
                title="Stop flagging this conversation until something new arrives"
                className="text-[12px] font-medium text-carbon-blue/55 hover:text-carbon-blue disabled:opacity-50"
              >
                No reply needed
              </button>
              <EmailMessageActions
                compact
                toEmail={target}
                subject={lead.subject}
                bodyPreview={lead.bodyPreview}
                contactId={contactId}
                contactName={contactName}
                contactPhone={contactPhone}
                opportunityId={dealId ?? undefined}
                opportunityName={dealMessage?.opportunityName ?? null}
                projectId={projectId ?? undefined}
                projectName={projectMessage?.projectName ?? null}
                status={thread.status}
                role={role}
              />
            </>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => onRemove(thread, contactId)}
            aria-label={`Remove “${subject}” from SmartCRM`}
            title="Remove from SmartCRM (stays in Outlook)"
            className="inline-flex size-7 items-center justify-center border border-carbon-blue/15 bg-white text-carbon-blue/50 hover:border-thermal-red/40 hover:text-thermal-red disabled:opacity-50"
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onToggle}
            aria-label={expanded ? "Close conversation" : "Open conversation"}
            className="inline-flex size-7 items-center justify-center border border-carbon-blue/15 bg-white text-carbon-blue/60 hover:border-upcycle-orange/40 hover:text-upcycle-orange"
          >
            <ChevronDown
              className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`}
              aria-hidden
            />
          </button>
        </div>
      </div>

      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-carbon-blue/55">
        {companyKey && companyName ? (
          <Link
            href={company360Href(companyKey)}
            className="font-semibold text-carbon-blue hover:text-upcycle-orange hover:underline"
          >
            {companyName}
          </Link>
        ) : null}
        {contactId && contactName ? (
          <Link
            href={contact360Href(contactId, companyKey ?? undefined)}
            className="font-medium text-upcycle-orange hover:underline"
          >
            {contactName}
          </Link>
        ) : null}
        {dealId ? (
          <Link
            href={deal360Href(dealId)}
            className="font-medium text-upcycle-orange hover:underline"
          >
            {dealMessage?.opportunityName || "Opportunity"}
          </Link>
        ) : null}
        {projectId ? (
          <Link
            href={project360Href(projectId)}
            className="font-medium text-upcycle-orange hover:underline"
          >
            {projectMessage?.projectName || "Project"}
          </Link>
        ) : null}
      </p>

      {copy && copy.tone !== "quiet" ? (
        <p
          className={`mt-1 text-[12px] leading-relaxed ${
            copy.tone === "alert" ? "text-thermal-red" : "text-carbon-blue/70"
          }`}
        >
          {copy.impact}
        </p>
      ) : null}

      {expanded ? (
        <div className="mt-3 space-y-3 border-t border-carbon-blue/10 pt-3">
          <ThreadCorrespondencePreview
            messages={readerMessages}
            contactName={contactName}
            role={role}
            presentation="reader"
            dateSort={dateSort}
          />

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {canReply ? (
              <EmailMessageActions
                toEmail={target}
                subject={lead.subject}
                bodyPreview={lead.bodyPreview}
                contactId={contactId}
                contactName={contactName}
                contactPhone={contactPhone}
                opportunityId={dealId ?? undefined}
                opportunityName={dealMessage?.opportunityName ?? null}
                projectId={projectId ?? undefined}
                projectName={projectMessage?.projectName ?? null}
                status={thread.status}
                role={role}
              />
            ) : null}
            {!lead.isDeletedInSource ? (
              <button
                type="button"
                onClick={() => onCreateActivity(thread)}
                className="inline-flex items-center border border-carbon-blue/20 bg-white px-2.5 py-1 text-[12px] font-semibold text-carbon-blue hover:border-upcycle-orange hover:text-upcycle-orange"
              >
                Create task
              </button>
            ) : null}
            {!lead.isDeletedInSource &&
            onAssignColleague &&
            assignableOptions.length > 0 ? (
              <select
                value=""
                disabled={busy}
                aria-label="Assign task from this conversation to a colleague"
                onChange={(event) => {
                  const chosen = assignableOptions.find(
                    (option) => String(option.Id) === event.target.value,
                  );
                  if (chosen) onAssignColleague(thread, chosen);
                }}
                className="border border-carbon-blue/20 bg-white px-2 py-1 text-[12px] font-semibold text-carbon-blue hover:border-upcycle-orange disabled:opacity-50"
              >
                <option value="" disabled>
                  Assign to colleague…
                </option>
                {assignableOptions.map((option) => (
                  <option key={option.Id} value={option.Id}>
                    {option.Title}
                  </option>
                ))}
              </select>
            ) : null}
            {canFileAttachments ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => onFileAttachments?.(thread)}
                className="inline-flex items-center border border-carbon-blue/20 bg-white px-2.5 py-1 text-[12px] font-semibold text-carbon-blue hover:border-upcycle-orange hover:text-upcycle-orange disabled:opacity-50"
              >
                File attachments
              </button>
            ) : null}
            {needsAnswerStatus ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => onHandled(thread)}
                className="inline-flex items-center text-[12px] font-medium text-carbon-blue/60 hover:text-carbon-blue disabled:opacity-50"
              >
                No reply needed
              </button>
            ) : null}
            {lead.webLink ? (
              <a
                href={lead.webLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[12px] font-medium text-carbon-blue/60 hover:text-upcycle-orange"
              >
                Open in Outlook
                <ExternalLink className="size-3" aria-hidden />
              </a>
            ) : null}
          </div>

          {offerOpportunity && companyKey ? (
            <div className="border border-carbon-blue/10 bg-white px-3 py-2">
              <p className="text-[12px] leading-relaxed text-carbon-blue/75">
                {mailOpportunityImpact({
                  topic,
                  contactName,
                  existingDealName: sameCompanyDeals.find((deal) => deal.id === matchingDeal?.id)?.name ?? null,
                })}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                {matchingDeal ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onLink(thread, contactId, { opportunityId: matchingDeal.id })}
                    className="inline-flex items-center border border-upcycle-orange bg-upcycle-orange px-2.5 py-1 text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    Add to {matchingDeal.assetName}
                  </button>
                ) : (
                  <Link
                    href={companyMailHref(companyKey, lead.id)}
                    className="inline-flex items-center border border-upcycle-orange bg-upcycle-orange px-2.5 py-1 text-[12px] font-semibold text-white hover:opacity-90"
                  >
                    Create opportunity
                  </Link>
                )}
              </div>
            </div>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-2">
            <WorkSelect
              label="Opportunity"
              value={dealId}
              fallbackLabel={dealMessage?.opportunityName ?? null}
              options={opportunityOptions}
              companyId={companyUuid}
              disabled={busy}
              onChange={(id) => onLink(thread, contactId, { opportunityId: id })}
            />
            <WorkSelect
              label="Project"
              value={projectId}
              fallbackLabel={projectMessage?.projectName ?? null}
              options={projectOptions}
              companyId={null}
              disabled={busy}
              onChange={(id) => onLink(thread, contactId, { projectId: id })}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => onRemove(thread, contactId)}
              className="text-[12px] font-medium text-carbon-blue/65 hover:text-thermal-red disabled:opacity-50"
            >
              Remove from SmartCRM (stays in Outlook)
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
