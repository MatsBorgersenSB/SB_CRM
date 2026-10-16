/**
 * When a colleague is given an activity: should we tell them, and what do we say?
 * One ping per ownership transfer — not when you assign yourself.
 */

export function assignmentShouldNotify(input: {
  previousOwnerId?: number | null;
  nextOwnerId?: number | null;
  assignerId?: number | null;
  assignerEmail?: string | null;
  assigneeEmail?: string | null;
  assignerTitle?: string | null;
  assigneeTitle?: string | null;
}): boolean {
  const nextId = input.nextOwnerId;
  if (!nextId) return false;
  if (input.previousOwnerId != null && input.previousOwnerId === nextId) return false;
  if (input.assignerId != null && input.assignerId === nextId) return false;

  const assignerEmail = input.assignerEmail?.trim().toLowerCase() ?? "";
  const assigneeEmail = input.assigneeEmail?.trim().toLowerCase() ?? "";
  if (assignerEmail && assigneeEmail && assignerEmail === assigneeEmail) return false;

  const assignerTitle = input.assignerTitle?.trim().toLowerCase() ?? "";
  const assigneeTitle = input.assigneeTitle?.trim().toLowerCase() ?? "";
  if (assignerTitle && assigneeTitle && assignerTitle === assigneeTitle) return false;

  return true;
}

/** Stable link for this ownership transfer — a later reassignment can ping again. */
export function assignmentNoticeLink(input: {
  activityId: string;
  assigneeId: number;
  previousOwnerId?: number | null;
}): string {
  const from = input.previousOwnerId != null ? String(input.previousOwnerId) : "none";
  return `/activities/${encodeURIComponent(input.activityId)}?assigned=${input.assigneeId}&from=${from}`;
}

export function assignmentNoticeCopy(input: {
  subject: string;
  assignerTitle?: string | null;
  companyName?: string | null;
  dueDate?: string | null;
  openUrl: string;
}): {
  title: string;
  message: string;
  mailSubject: string;
  html: string;
} {
  const subject = input.subject.trim() || "a task";
  const who = input.assignerTitle?.trim() || "A colleague";
  const company = input.companyName?.trim() || "";
  const due = input.dueDate?.trim() || "";
  const title = "Assigned to you";
  const message = `${who} assigned you: ${subject}`;
  const mailSubject = `${title}: ${subject}`;

  const details = [company, due ? `Due ${due}` : ""]
    .filter(Boolean)
    .map((line) => escapeHtml(line))
    .join("<br/>");

  const html = [
    `<p><strong>${escapeHtml(who)}</strong> assigned you a task in SmartCRM.</p>`,
    `<p><strong>${escapeHtml(subject)}</strong>${details ? `<br/>${details}` : ""}</p>`,
    `<p><a href="${escapeHtml(input.openUrl)}">Open in SmartCRM</a></p>`,
  ].join("");

  return { title, message, mailSubject, html };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
