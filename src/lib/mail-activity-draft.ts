import { knownLineFromMail, mailTopic } from "@/lib/mail-opportunity-draft";
import { readableMailText } from "@/lib/mail-preview-text";
import type { MailThreadStatus } from "@/lib/mail-triage";
import { toCompanyTrackingId, toContactTrackingId } from "@/lib/prisma-mappers";
import type { CreateActivityInput } from "@/types/activity";

/**
 * Starting point for a task made from a mail. Everything is taken from the mail and the
 * records it is already linked to — nothing is invented. The user edits and saves in the
 * activity form, and can assign it to a colleague there.
 */
export function buildMailActivityPreset(input: {
  lead: {
    id: string;
    conversationId: string;
    subject: string;
    bodyPreview: string | null;
    sentAt: string;
  };
  status: MailThreadStatus;
  contactId: string | null;
  contactName: string | null;
  companyId: string | null;
  companyCode: string | null;
  opportunityId: string | null;
  projectId: string | null;
  projectName: string | null;
  today?: string;
}): Partial<CreateActivityInput> {
  const topic = mailTopic(input.lead.subject) || input.lead.subject.trim() || "Mail";
  const who = input.contactName?.trim() || null;

  let subject = topic;
  if (input.status.kind === "reply_needed") subject = `Reply${who ? ` to ${who}` : ""}: ${topic}`;
  else if (input.status.kind === "waiting_on_them") subject = `Follow up: ${topic}`;
  else if (input.status.kind === "delivery_failed") subject = `Resend: ${topic}`;

  const preview = knownLineFromMail(readableMailText(input.lead.bodyPreview));
  const sent = input.lead.sentAt.slice(0, 10);
  const lines = [`From the mail “${topic}”${sent ? ` (${sent})` : ""}.`];
  if (input.status.kind === "reply_needed" && input.status.ask) {
    lines.push(`They asked: “${input.status.ask}”`);
  } else if (preview) {
    lines.push(preview);
  }

  const today = input.today ?? new Date().toISOString().slice(0, 10);
  const companyKey = input.companyCode?.trim() || (input.companyId ? toCompanyTrackingId(input.companyId) : "");

  return {
    ActivityType: "Task",
    Subject: subject,
    ActivityDescription: lines.join("\n"),
    ActivityDate: `${today}T09:00:00.000Z`,
    ActionRequired: true,
    NextAction: subject,
    NextActionDate: today,
    ActionStatus: "Open",
    ActionOutcome: "",
    Company: companyKey ? { CompanyID: companyKey } : null,
    Contact: input.contactId ? { ContactID: toContactTrackingId(input.contactId) } : null,
    Deal: input.opportunityId ? { DealID: input.opportunityId } : null,
    ProjectId: input.projectId,
    ProjectName: input.projectName,
    OutlookMessageId: input.lead.id,
    OutlookConversationId: input.lead.conversationId,
  };
}
