"use client";

import { useMemo, useState } from "react";
import type { Activity } from "@/types/activity";
import type { CommercialPackage } from "@/types/commercial-package";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type { OpportunityUnderstanding } from "@/lib/opportunity-workspace-intelligence";
import type { RecommendedTimelineMilestone } from "@/lib/opportunity-timeline";
import {
  buildOpportunityExecutionContext,
  prepareOpportunityEmail,
  prepareOpportunityMeeting,
  prepareOpportunityPlan,
  scheduleNextMilestone,
  type PreparedEmail,
  type PreparedMilestoneSchedule,
  type PreparedOpportunityPlan,
} from "@/lib/opportunity-execution-assist";
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

export type SmartAssistAction = "email" | "meeting" | "plan" | "schedule";

const ACTION_LABELS: Record<SmartAssistAction, string> = {
  email: "Prepare Email",
  meeting: "Prepare Meeting",
  plan: "Create Opportunity Plan",
  schedule: "Schedule Next Milestone",
};

export function OpportunitySmartAssistActions({
  pipeline,
  companies,
  commercialPackages,
  understanding,
  activities,
  actions,
  scheduleTarget,
}: {
  pipeline: PipelineRow;
  companies: Company[];
  commercialPackages: CommercialPackage[];
  understanding: OpportunityUnderstanding;
  activities: Activity[];
  actions: SmartAssistAction[];
  scheduleTarget?: RecommendedTimelineMilestone | null;
}) {
  const [mode, setMode] = useState<SmartAssistAction | null>(null);
  const [copied, setCopied] = useState(false);

  const executionContext = useMemo(
    () =>
      buildOpportunityExecutionContext(
        pipeline,
        companies,
        commercialPackages,
        understanding,
      ),
    [pipeline, companies, commercialPackages, understanding],
  );

  const preparedEmail = useMemo(
    () => (mode === "email" ? prepareOpportunityEmail(executionContext) : null),
    [mode, executionContext],
  );

  const preparedMeeting = useMemo(
    () => (mode === "meeting" ? prepareOpportunityMeeting(executionContext) : null),
    [mode, executionContext],
  );

  const preparedPlan = useMemo(
    () =>
      mode === "plan"
        ? prepareOpportunityPlan(executionContext, activities, commercialPackages)
        : null,
    [mode, executionContext, activities, commercialPackages],
  );

  const preparedSchedule = useMemo(
    () =>
      mode === "schedule"
        ? scheduleNextMilestone(
            executionContext,
            activities,
            commercialPackages,
            scheduleTarget,
          )
        : null,
    [mode, executionContext, activities, commercialPackages, scheduleTarget],
  );

  const handleCopyEmail = async (email: PreparedEmail) => {
    const text = `To: ${email.to}\nSubject: ${email.subject}\n\n${email.body}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyPlan = async (plan: PreparedOpportunityPlan) => {
    const text = [
      plan.headline,
      "",
      `Objective: ${plan.objective}`,
      `Current phase: ${plan.currentPhase}`,
      "",
      "Phases:",
      ...plan.phases.map(
        (phase) => `• ${phase.phase} (${phase.timing}) — ${phase.focus}`,
      ),
      "",
      "Priority actions:",
      ...plan.priorityActions.map((action) => `• ${action}`),
      "",
      "Risks to watch:",
      ...plan.risksToWatch.map((risk) => `• ${risk}`),
    ].join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const toggle = (action: SmartAssistAction) => {
    setMode((current) => (current === action ? null : action));
    setCopied(false);
  };

  return (
    <div className={`flex flex-col ${EDITORIAL_GAP_BLOCK}`}>
      <div className={WORKSPACE_MODE_NAV}>
        {actions.map((action) => (
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

      {preparedEmail ? (
        <PreparedEmailPanel
          email={preparedEmail}
          copied={copied}
          onCopy={() => void handleCopyEmail(preparedEmail)}
        />
      ) : null}

      {preparedMeeting ? <PreparedMeetingPanel meeting={preparedMeeting} /> : null}

      {preparedPlan ? (
        <PreparedPlanPanel
          plan={preparedPlan}
          copied={copied}
          onCopy={() => void handleCopyPlan(preparedPlan)}
        />
      ) : null}

      {preparedSchedule ? <PreparedSchedulePanel schedule={preparedSchedule} /> : null}
    </div>
  );
}

function PreparedEmailPanel({
  email,
  copied,
  onCopy,
}: {
  email: PreparedEmail;
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

function PreparedMeetingPanel({ meeting }: { meeting: ReturnType<typeof prepareOpportunityMeeting> }) {
  return <SmartAssistMeetingDisplay meeting={meeting} variant="panel" />;
}

function PreparedPlanPanel({
  plan,
  copied,
  onCopy,
}: {
  plan: PreparedOpportunityPlan;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <EditorialPanel>
      <div className="flex items-start justify-between gap-4">
        <p className={EDITORIAL_LABEL}>Opportunity plan</p>
        <button type="button" onClick={onCopy} className={EDITORIAL_TEXT_ACTION}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className={`mt-3 ${EDITORIAL_TITLE}`}>{plan.headline}</p>
      <AssistField label="Customer objective" value={plan.objective} />
      <AssistField label="Current phase" value={plan.currentPhase} />

      <div className="mt-5">
        <p className={EDITORIAL_FIELD_LABEL}>Phases</p>
        <ul className="mt-2 space-y-3">
          {plan.phases.map((phase) => (
            <li key={phase.phase} className={EDITORIAL_BODY}>
              <span className="font-medium text-carbon-blue">{phase.phase}</span>
              <span className="text-carbon-blue/45"> · {phase.timing}</span>
              <p className="mt-0.5 text-carbon-blue/65">{phase.focus}</p>
            </li>
          ))}
        </ul>
      </div>

      <AssistList label="Priority actions" items={plan.priorityActions} ordered />
      {plan.risksToWatch.length > 0 ? (
        <AssistList label="Risks to watch" items={plan.risksToWatch} />
      ) : null}
    </EditorialPanel>
  );
}

function PreparedSchedulePanel({ schedule }: { schedule: PreparedMilestoneSchedule }) {
  return (
    <EditorialPanel>
      <p className={EDITORIAL_LABEL}>Scheduled milestone</p>
      <p className={`mt-3 ${EDITORIAL_TITLE}`}>{schedule.milestone}</p>
      <AssistField label="Suggested timing" value={schedule.suggestedDate} />
      <AssistField label="Owner" value={schedule.owner} />
      <AssistField label="Duration" value={schedule.duration} />
      <AssistList label="Prep actions" items={schedule.prepActions} ordered />
      <AssistField label="Success criteria" value={schedule.successCriteria} />
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
