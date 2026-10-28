import { mailTopic } from "@/lib/mail-opportunity-draft";
import { readableMailText } from "@/lib/mail-preview-text";
import type { MailThreadStatus } from "@/lib/mail-triage";

export type SmartMailReplyDraftInput = {
  subject: string;
  bodyPreview: string | null;
  contactName?: string | null;
  status?: MailThreadStatus;
  opportunityName?: string | null;
  projectName?: string | null;
};

export type SmartMailReplyDraft = {
  subject: string;
  bodyHtml: string;
  objective: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function firstName(contactName: string | null | undefined): string | null {
  const trimmed = contactName?.trim();
  if (!trimmed) return null;
  if (trimmed.includes("@")) return null;
  return trimmed.split(/\s+/)[0] || null;
}

export function replySubject(subject: string): string {
  const trimmed = subject.trim();
  if (!trimmed) return "Re:";
  return /^re:/i.test(trimmed) ? trimmed : `Re: ${trimmed}`;
}

/**
 * Deterministic, Reality-First reply draft from actual thread evidence:
 * - Greets the contact by first name when known
 * - Addresses the extracted inbound ask when status is `reply_needed`
 * - Frames a polite follow-up when status is `waiting_on_them`
 * - References linked opportunity or project work without inventing facts
 */
export function buildSmartMailReplyDraft(
  input: SmartMailReplyDraftInput,
): SmartMailReplyDraft {
  const first = firstName(input.contactName);
  const greeting = first ? `<p>Hi ${escapeHtml(first)},</p>` : `<p>Hi,</p>`;
  const topic = mailTopic(input.subject) || input.subject.trim() || "your message";
  const workLabel =
    input.opportunityName?.trim() || input.projectName?.trim() || null;
  const workClause = workLabel ? ` regarding ${escapeHtml(workLabel)}` : "";

  let leadParagraph: string;
  let objective: string;

  if (input.status?.kind === "reply_needed" && input.status.ask?.trim()) {
    const ask = input.status.ask.trim();
    leadParagraph = `<p>Thank you for your note${workClause}. Following up on your question — “${escapeHtml(ask)}”:</p>`;
    objective = `Answer ${first ?? "their"} ask: “${ask}”`;
  } else if (input.status?.kind === "reply_needed") {
    leadParagraph = `<p>Thank you for your message${workClause}. Following up on ${escapeHtml(topic)} and confirming next steps:</p>`;
    objective = `Reply to ${first ?? "contact"} on ${topic}`;
  } else if (input.status?.kind === "waiting_on_them") {
    const days = input.status.days;
    const age =
      days >= 1 ? ` from ${days} day${days === 1 ? "" : "s"} ago` : "";
    leadParagraph = `<p>Following up on my earlier note${age}${workClause} about ${escapeHtml(topic)} to see if you had any questions or an update on timing.</p>`;
    objective = `Follow up after ${days} day${days === 1 ? "" : "s"} waiting on ${topic}`;
  } else {
    leadParagraph = `<p>Thank you for your note${workClause}. Following up on the points below and confirming next steps.</p>`;
    objective = workLabel
      ? `Advance ${workLabel} correspondence`
      : `Follow up on ${topic}`;
  }

  const cleanedPreview = readableMailText(input.bodyPreview);
  const previewBlock = cleanedPreview
    ? `<blockquote style="border-left:3px solid #ccc;padding-left:8px;color:#555">${escapeHtml(cleanedPreview)}</blockquote>`
    : "";

  return {
    subject: replySubject(input.subject),
    bodyHtml: [greeting, leadParagraph, previewBlock, `<p>Best regards</p>`]
      .filter(Boolean)
      .join(""),
    objective,
  };
}
