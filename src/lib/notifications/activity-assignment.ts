/**
 * When a colleague is given an activity or record ownership: should we tell them, and what do we say?
 * One ping per ownership transfer — not when you assign yourself.
 */

export type OwnershipEntityKind =
  | "activity"
  | "company"
  | "contact"
  | "opportunity"
  | "project";

export function assignmentShouldNotify(input: {
  previousOwnerId?: number | null;
  nextOwnerId?: number | null;
  previousOwnerTitle?: string | null;
  assignerId?: number | null;
  assignerEmail?: string | null;
  assigneeEmail?: string | null;
  assignerTitle?: string | null;
  assigneeTitle?: string | null;
}): boolean {
  const nextId = input.nextOwnerId;
  if (!nextId || nextId <= 0) return false;
  if (
    input.previousOwnerId != null &&
    input.previousOwnerId > 0 &&
    input.previousOwnerId === nextId
  ) {
    return false;
  }

  const previousTitle = input.previousOwnerTitle?.trim().toLowerCase() ?? "";
  const assigneeTitle = input.assigneeTitle?.trim().toLowerCase() ?? "";
  if (previousTitle && assigneeTitle && previousTitle === assigneeTitle) {
    return false;
  }

  if (input.assignerId != null && input.assignerId === nextId) return false;

  const assignerEmail = input.assignerEmail?.trim().toLowerCase() ?? "";
  const assigneeEmail = input.assigneeEmail?.trim().toLowerCase() ?? "";
  if (assignerEmail && assigneeEmail && assignerEmail === assigneeEmail) return false;

  const assignerTitle = input.assignerTitle?.trim().toLowerCase() ?? "";
  if (assignerTitle && assigneeTitle && assignerTitle === assigneeTitle) return false;

  return true;
}

/** Stable link for any record ownership transfer — a later reassignment can ping again. */
export function ownershipNoticeLink(input: {
  kind: OwnershipEntityKind;
  entityId: string;
  assigneeId: number;
  previousOwnerId?: number | null;
}): string {
  const from =
    input.previousOwnerId != null && input.previousOwnerId > 0
      ? String(input.previousOwnerId)
      : "none";
  const id = encodeURIComponent(input.entityId);
  const basePath =
    input.kind === "company"
      ? `/companies/${id}`
      : input.kind === "contact"
        ? `/contacts/${id}`
        : input.kind === "opportunity"
          ? `/opportunities/${id}`
          : input.kind === "project"
            ? `/projects/${id}`
            : `/activities/${id}`;
  return `${basePath}?assigned=${input.assigneeId}&from=${from}`;
}

/** Stable link for this activity ownership transfer — a later reassignment can ping again. */
export function assignmentNoticeLink(input: {
  activityId: string;
  assigneeId: number;
  previousOwnerId?: number | null;
}): string {
  return ownershipNoticeLink({
    kind: "activity",
    entityId: input.activityId,
    assigneeId: input.assigneeId,
    previousOwnerId: input.previousOwnerId,
  });
}

const OWNERSHIP_KIND_META: Record<
  Exclude<OwnershipEntityKind, "activity">,
  {
    title: string;
    noun: string;
    roleLabel: string;
    fallbackSubject: string;
  }
> = {
  company: {
    title: "Account ownership assigned to you",
    noun: "company",
    roleLabel: "Account Owner",
    fallbackSubject: "a company",
  },
  contact: {
    title: "Contact ownership assigned to you",
    noun: "contact",
    roleLabel: "Contact Owner",
    fallbackSubject: "a contact",
  },
  opportunity: {
    title: "Opportunity ownership assigned to you",
    noun: "opportunity",
    roleLabel: "Opportunity Owner",
    fallbackSubject: "an opportunity",
  },
  project: {
    title: "Project ownership assigned to you",
    noun: "project",
    roleLabel: "Project Owner",
    fallbackSubject: "a project",
  },
};

export function ownershipNoticeCopy(input: {
  kind?: OwnershipEntityKind;
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
  const kind = input.kind ?? "activity";
  const who = input.assignerTitle?.trim() || "A colleague";
  const company = input.companyName?.trim() || "";
  const due = input.dueDate?.trim() || "";

  if (kind === "activity") {
    const subject = input.subject.trim() || "a task";
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

  const meta = OWNERSHIP_KIND_META[kind];
  const subject = input.subject.trim() || meta.fallbackSubject;
  const title = meta.title;
  const companySuffix =
    kind !== "company" && company && company.toLowerCase() !== subject.toLowerCase()
      ? ` (${company})`
      : "";
  const message = `${who} assigned you responsibility for ${meta.noun}: ${subject}${companySuffix}`;
  const mailSubject = `${title}: ${subject}`;

  const details = [
    kind !== "company" && company ? company : "",
    due ? `Due ${due}` : "",
  ]
    .filter(Boolean)
    .map((line) => escapeHtml(line))
    .join("<br/>");

  const html = [
    `<p><strong>${escapeHtml(who)}</strong> assigned you responsibility as <strong>${escapeHtml(meta.roleLabel)}</strong> in SmartCRM.</p>`,
    `<p><strong>${escapeHtml(subject)}</strong>${details ? `<br/>${details}` : ""}</p>`,
    `<p><a href="${escapeHtml(input.openUrl)}">Open in SmartCRM</a></p>`,
  ].join("");

  return { title, message, mailSubject, html };
}

export function assignmentNoticeCopy(input: {
  kind?: OwnershipEntityKind;
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
  return ownershipNoticeCopy(input);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
