"use client";

import { useMemo, useState } from "react";
import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type { ActivityMissionControl } from "@/lib/activity-mission-control";
import {
  buildActivityExecutionContext,
  createWeeklyActionPlan,
  prepareCustomerMeeting,
  prepareFollowUpEmail,
  summarizeOpenRisks,
  type PreparedFollowUpEmail,
  type PreparedRiskSummary,
  type PreparedWeeklyPlan,
} from "@/lib/activity-execution-assist";
import { SmartAssistMeetingDisplay } from "@/components/smartassist/smartassist-meeting-display";
import {
  EDITORIAL_BODY,
  EDITORIAL_FIELD_LABEL,
  EDITORIAL_GAP_BLOCK,
  EDITORIAL_LABEL,
  EDITORIAL_TEXT_ACTION,
  EDITORIAL_TITLE,
  editorialAssistButtonClass,
} from "@/lib/editorial-design-system";
import { WORKSPACE_MODE_NAV } from "@/lib/workspace-mode-nav";
import { EditorialPanel } from "@/components/ui/editorial-primitives";

export type ActivitySmartAssistAction =
  | "email"
  | "meeting"
  | "risks"
  | "plan";

const ACTION_LABELS: Record<ActivitySmartAssistAction, string> = {
  email: "Prepare Follow-Up Email",
  meeting: "Prepare Customer Meeting",
  risks: "Summarize Open Risks",
  plan: "Create Weekly Action Plan",
};

export function ActivitySmartAssistActions({
  mission,
  activities,
  companies,
  pipelines,
  ownerName,
}: {
  mission: ActivityMissionControl;
  activities: Activity[];
  companies: Company[];
  pipelines: PipelineRow[];
  ownerName: string;
}) {
  const [mode, setMode] = useState<ActivitySmartAssistAction | null>(null);
  const [copied, setCopied] = useState(false);

  const context = useMemo(
    () =>
      buildActivityExecutionContext(
        mission,
        activities,
        companies,
        pipelines,
        ownerName,
      ),
    [mission, activities, companies, pipelines, ownerName],
  );

  const email = useMemo(
    () => (mode === "email" ? prepareFollowUpEmail(context) : null),
    [mode, context],
  );
  const meeting = useMemo(
    () => (mode === "meeting" ? prepareCustomerMeeting(context) : null),
    [mode, context],
  );
  const risks = useMemo(
    () => (mode === "risks" ? summarizeOpenRisks(context) : null),
    [mode, context],
  );
  const plan = useMemo(
    () => (mode === "plan" ? createWeeklyActionPlan(context) : null),
    [mode, context],
  );

  const copyText = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const toggle = (action: ActivitySmartAssistAction) => {
    setMode((current) => (current === action ? null : action));
    setCopied(false);
  };

  return (
    <div className={`flex flex-col ${EDITORIAL_GAP_BLOCK}`}>
      <div className={WORKSPACE_MODE_NAV}>
        {(Object.keys(ACTION_LABELS) as ActivitySmartAssistAction[]).map((action) => (
          <button
            key={action}
            type="button"
            onClick={() => toggle(action)}
            className={editorialAssistButtonClass(mode === action)}
          >
            {ACTION_LABELS[action]}
          </button>
        ))}
      </div>

      {email ? (
        <EmailPanel
          email={email}
          copied={copied}
          onCopy={() => void copyText(`To: ${email.to}\nSubject: ${email.subject}\n\n${email.body}`)}
        />
      ) : null}
      {meeting ? <MeetingPanel meeting={meeting} /> : null}
      {risks ? <RisksPanel summary={risks} /> : null}
      {plan ? (
        <PlanPanel
          plan={plan}
          copied={copied}
          onCopy={() =>
            void copyText(
              [
                plan.headline,
                "",
                "Priorities:",
                ...plan.priorities.map((item) => `• ${item}`),
                "",
                "Follow-ups:",
                ...plan.followUps.map((item) => `• ${item}`),
                "",
                "Risks to watch:",
                ...plan.risksToWatch.map((item) => `• ${item}`),
              ].join("\n"),
            )
          }
        />
      ) : null}
    </div>
  );
}

function EmailPanel({
  email,
  copied,
  onCopy,
}: {
  email: PreparedFollowUpEmail;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <EditorialPanel>
      <div className="flex items-start justify-between gap-4">
        <p className={EDITORIAL_LABEL}>Prepared email</p>
        <button type="button" onClick={onCopy} className={EDITORIAL_TEXT_ACTION}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <dl className="mt-4 space-y-2 text-[13px] text-carbon-blue/55">
        <div>
          <dt className="inline text-carbon-blue/40">To </dt>
          <dd className="inline text-carbon-blue/80">{email.to}</dd>
        </div>
        <div>
          <dt className="inline text-carbon-blue/40">Subject </dt>
          <dd className="inline text-carbon-blue">{email.subject}</dd>
        </div>
      </dl>
      <pre className={`mt-5 whitespace-pre-wrap font-sans ${EDITORIAL_BODY}`}>{email.body}</pre>
    </EditorialPanel>
  );
}

function MeetingPanel({ meeting }: { meeting: ReturnType<typeof prepareCustomerMeeting> }) {
  return <SmartAssistMeetingDisplay meeting={meeting} variant="panel" />;
}

function RisksPanel({ summary }: { summary: PreparedRiskSummary }) {
  return (
    <EditorialPanel>
      <p className={EDITORIAL_LABEL}>Open risks</p>
      <p className={`mt-3 ${EDITORIAL_TITLE}`}>{summary.headline}</p>
      {summary.risks.length > 0 ? (
        <ul className="mt-4 space-y-4">
          {summary.risks.map((item) => (
            <li key={item.risk}>
              <p className="text-[14px] font-medium text-carbon-blue">{item.risk}</p>
              <p className={`mt-1 ${EDITORIAL_BODY}`}>{item.context}</p>
              <p className={`mt-1 ${EDITORIAL_BODY}`}>{item.suggestedAction}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className={`mt-3 ${EDITORIAL_BODY}`}>No risks are flagged on open activities.</p>
      )}
    </EditorialPanel>
  );
}

function PlanPanel({
  plan,
  copied,
  onCopy,
}: {
  plan: PreparedWeeklyPlan;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <EditorialPanel>
      <div className="flex items-start justify-between gap-4">
        <p className={EDITORIAL_LABEL}>Weekly action plan</p>
        <button type="button" onClick={onCopy} className={EDITORIAL_TEXT_ACTION}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className={`mt-3 ${EDITORIAL_TITLE}`}>{plan.headline}</p>
      <AssistList label="Priorities" items={plan.priorities} ordered />
      {plan.meetings.length > 0 ? (
        <AssistList label="Meetings" items={plan.meetings} />
      ) : null}
      <AssistList label="Follow-ups" items={plan.followUps} />
      {plan.risksToWatch.length > 0 ? (
        <AssistList label="Risks to watch" items={plan.risksToWatch} />
      ) : null}
    </EditorialPanel>
  );
}

function AssistField({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-5">
      <p className={EDITORIAL_FIELD_LABEL}>{label}</p>
      <p className={`mt-1 ${EDITORIAL_BODY}`}>{value}</p>
    </div>
  );
}

function AssistList({
  label,
  items,
  ordered = false,
}: {
  label: string;
  items: string[];
  ordered?: boolean;
}) {
  if (items.length === 0) return null;
  const Tag = ordered ? "ol" : "ul";
  return (
    <div className="mt-5">
      <p className={EDITORIAL_FIELD_LABEL}>{label}</p>
      <Tag className={`mt-2 space-y-1.5 ${ordered ? "list-decimal pl-5" : "list-disc pl-5"}`}>
        {items.map((item) => (
          <li key={item} className={EDITORIAL_BODY}>
            {item}
          </li>
        ))}
      </Tag>
    </div>
  );
}
