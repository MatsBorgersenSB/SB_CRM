"use client";

import { useRouter } from "next/navigation";
import {
  m365ComposeHref,
  outlookComposeHref,
  teamsMeetingComposeHref,
  telHref,
} from "@/lib/compose-actions";
import { stashSmartAssistPrefill } from "@/lib/smart-assist-prefill";
import { SMARTASSIST_ACTION_PRINCIPLE } from "@/lib/smart-assist-config";
import type { AttentionItem } from "@/types/attention-item";
import type { SmartAssistEmailBriefing } from "@/types/smartassist-email";
import { SmartAssistConfidenceLabel } from "@/components/smartassist/smartassist-intelligence-display";
import {
  EDITORIAL_BODY,
  EDITORIAL_FIELD_LABEL,
  EDITORIAL_LABEL,
  EDITORIAL_META,
} from "@/lib/editorial-design-system";

const actionButtonClass =
  "inline-flex items-center border border-upcycle-orange/35 bg-upcycle-orange px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-white transition-colors hover:bg-upcycle-orange/90";

const secondaryButtonClass =
  "inline-flex items-center border border-carbon-blue/15 bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-carbon-blue/70 transition-colors hover:border-upcycle-orange/30 hover:text-upcycle-orange";

function AssistRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className={EDITORIAL_FIELD_LABEL}>{label}</dt>
      <dd className={`mt-0.5 ${EDITORIAL_BODY}`}>{value}</dd>
    </div>
  );
}

export function SmartAssistEmailAssistant({
  briefing,
  attentionItem,
  contactPhone,
  onClose,
}: {
  briefing: SmartAssistEmailBriefing;
  attentionItem: AttentionItem;
  contactPhone?: string;
  onClose: () => void;
}) {
  const router = useRouter();

  const handleCreateFollowUp = () => {
    stashSmartAssistPrefill({
      ActivityType: "Email Follow-Up",
      Subject: `Follow up — ${briefing.contactName}`,
      companyId: attentionItem.companyId,
      contactId:
        attentionItem.objectType === "Contact" ? attentionItem.sourceObjectId : undefined,
      planDate: attentionItem.dueDate?.slice(0, 10),
      knowledgeDraft: {
        Summary: briefing.suggestedFollowUp,
        NextAction: briefing.suggestedFollowUp,
        ActionRequired: true,
        ActionStatus: "Planned",
      },
    });
    onClose();
    router.push("/activities");
  };

  const meetingBody = [
    briefing.suggestedMeeting,
    "",
    `Objective: ${briefing.objective}`,
    "",
    `Expected outcome: ${briefing.expectedOutcome}`,
  ].join("\n");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-carbon-blue/40 p-4 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="smartassist-email-title"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden border border-carbon-blue/10 bg-white shadow-xl"
      >
        <header className="border-b border-carbon-blue/10 px-5 py-4">
          <p className={EDITORIAL_LABEL}>SmartAssist · Email Assistant</p>
          <h2 id="smartassist-email-title" className="mt-1 text-lg font-semibold text-carbon-blue">
            {briefing.actionLabel}
          </h2>
          <p className={`mt-1 ${EDITORIAL_META}`}>{SMARTASSIST_ACTION_PRINCIPLE.rule}</p>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <dl className="grid gap-4 sm:grid-cols-2">
            <AssistRow label="Reason" value={briefing.reason} />
            <AssistRow label="Objective" value={briefing.objective} />
            <div className="sm:col-span-2">
              <AssistRow label="Expected outcome" value={briefing.expectedOutcome} />
            </div>
            <div>
              <dt className={EDITORIAL_FIELD_LABEL}>Confidence</dt>
              <dd className="mt-1 flex items-center gap-2">
                <span className="text-sm font-semibold text-carbon-blue">{briefing.confidenceLabel}</span>
                <SmartAssistConfidenceLabel confidence={briefing.confidence} />
              </dd>
            </div>
            <AssistRow label="To" value={briefing.to} />
          </dl>

          <div className="mt-6 space-y-4 border-t border-carbon-blue/10 pt-5">
            <AssistRow label="Subject" value={briefing.subject} />
            <div>
              <p className={EDITORIAL_FIELD_LABEL}>Email draft</p>
              <pre className="mt-2 whitespace-pre-wrap border border-carbon-blue/10 bg-carbon-blue/[0.02] p-3 font-sans text-[13px] leading-relaxed text-carbon-blue/80">
                {briefing.body}
              </pre>
            </div>
            <AssistRow label="Suggested follow-up" value={briefing.suggestedFollowUp} />
            <AssistRow label="Suggested meeting option" value={briefing.suggestedMeeting} />
          </div>
        </div>

        <footer className="flex flex-wrap gap-2 border-t border-carbon-blue/10 bg-carbon-blue/[0.02] px-5 py-4">
          <a
            href={m365ComposeHref(briefing.to, briefing.subject, briefing.body)}
            target="_blank"
            rel="noopener noreferrer"
            className={actionButtonClass}
          >
            Create Outlook Draft
          </a>
          <a
            href={outlookComposeHref(briefing.to, briefing.subject, briefing.body)}
            target="_blank"
            rel="noopener noreferrer"
            className={secondaryButtonClass}
          >
            Open Outlook
          </a>
          <a
            href={teamsMeetingComposeHref(briefing.suggestedMeetingTitle, meetingBody)}
            target="_blank"
            rel="noopener noreferrer"
            className={secondaryButtonClass}
          >
            Schedule Teams Meeting
          </a>
          {contactPhone ? (
            <a href={telHref(contactPhone)} className={secondaryButtonClass}>
              Schedule Call
            </a>
          ) : (
            <button type="button" onClick={handleCreateFollowUp} className={secondaryButtonClass}>
              Schedule Call
            </button>
          )}
          <button type="button" onClick={handleCreateFollowUp} className={secondaryButtonClass}>
            Create Follow-Up Activity
          </button>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto border border-carbon-blue/15 px-3 py-2 text-[11px] font-semibold text-carbon-blue/55 hover:text-carbon-blue"
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
