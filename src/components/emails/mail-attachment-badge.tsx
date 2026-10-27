import type { EmailMessageIntelligenceDto } from "@/lib/email-intelligence-data";

type AttachmentSignal = {
  attachmentLedger?: EmailMessageIntelligenceDto["attachmentLedger"];
  attachments?: EmailMessageIntelligenceDto["attachments"];
  hasAttachments?: boolean | null;
};

export type MailAttachmentSummary =
  | { kind: "none" }
  | { kind: "filed"; count: number }
  | { kind: "incomplete"; filed: number; expected: number }
  | { kind: "unfiled" };

/** Roll a thread's messages up into one attachment signal. Unknown stays unknown. */
export function summarizeMailAttachments(messages: AttachmentSignal[]): MailAttachmentSummary {
  let expected = 0;
  let filed = 0;
  let incomplete = false;
  let flagged = false;
  let ledgerSeen = false;

  for (const message of messages) {
    const ledger = message.attachmentLedger;
    if (ledger) {
      ledgerSeen = true;
      expected += ledger.expected;
      filed += ledger.filed;
      if (ledger.status === "partial" || ledger.status === "unfiled" || ledger.status === "failed") {
        incomplete = true;
      }
    } else if (message.hasAttachments) {
      flagged = true;
    } else if ((message.attachments?.length ?? 0) > 0) {
      const count = message.attachments?.length ?? 0;
      ledgerSeen = true;
      expected += count;
      filed += count;
    }
  }

  if (incomplete) return { kind: "incomplete", filed, expected };
  if (flagged) return { kind: "unfiled" };
  if (ledgerSeen && filed > 0) return { kind: "filed", count: filed };
  return { kind: "none" };
}

function PaperclipIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

/** Paperclip cue for mail lists: has files, are they filed, what is missing. */
export function MailAttachmentBadge({ messages }: { messages: AttachmentSignal[] }) {
  const summary = summarizeMailAttachments(messages);
  if (summary.kind === "none") return null;

  let label: string;
  let tone: string;
  if (summary.kind === "filed") {
    label = `${summary.count} attachment${summary.count === 1 ? "" : "s"} filed`;
    tone = "border-carbon-blue/15 bg-carbon-blue/[0.04] text-carbon-blue/75";
  } else if (summary.kind === "incomplete") {
    label =
      summary.expected > 0
        ? `${summary.filed} of ${summary.expected} attachments filed`
        : "Attachments not filed";
    tone = "border-thermal-red/30 bg-thermal-red/[0.06] text-thermal-red";
  } else {
    label = "Has attachments · not filed yet";
    tone = "border-upcycle-orange/40 bg-upcycle-orange/[0.08] text-upcycle-orange";
  }

  return (
    <span
      className={`inline-flex items-center gap-1 border px-1.5 py-0.5 text-[11px] font-semibold ${tone}`}
      title={label}
    >
      <PaperclipIcon />
      {label}
    </span>
  );
}
