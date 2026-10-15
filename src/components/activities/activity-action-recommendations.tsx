"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type {
  ActivityRecommendedActionType,
  PreparedTeamsMeetingAction,
} from "@/types/activity-action-recommendations";
import { ACTIVITY_ACTION_LABELS } from "@/types/activity-action-recommendations";
import type { ActivityBriefing } from "@/lib/activity-briefing";
import {
  buildActivityActionRecommendations,
  buildActivityActionRecommendationsForType,
} from "@/lib/activity-action-recommendations";
import { SmartAssistConfidenceLabel } from "@/components/smartassist/smartassist-intelligence-display";
import { m365ComposeHref, telHref } from "@/lib/compose-actions";
import { formatSmartAssistMeetingForCompose } from "@/lib/smartassist-meeting-engine";
import { SmartAssistMeetingDisplay } from "@/components/smartassist/smartassist-meeting-display";
import { stashSmartAssistPrefill } from "@/lib/smart-assist-prefill";
import { syncActivityUpdate } from "@/lib/sync-activity";
import {
  EDITORIAL_BODY,
  EDITORIAL_FIELD_LABEL,
  EDITORIAL_LABEL,
  EDITORIAL_META,
} from "@/lib/editorial-design-system";
import { WORKSPACE_PANEL_SURFACE } from "@/lib/workspace-design-system";

export function ActivityActionRecommendationsPanel({
  activity,
  briefing,
  companies,
  pipelines,
  selectedType,
  onSelectedTypeChange,
}: {
  activity: Activity;
  briefing: ActivityBriefing;
  companies: Company[];
  pipelines: PipelineRow[];
  selectedType: ActivityRecommendedActionType | null;
  onSelectedTypeChange: (type: ActivityRecommendedActionType | null) => void;
}) {
  const router = useRouter();
  const [closing, setClosing] = useState(false);

  const recommendations = useMemo(() => {
    if (selectedType) {
      return buildActivityActionRecommendationsForType(
        activity,
        briefing,
        companies,
        pipelines,
        selectedType,
      );
    }
    return buildActivityActionRecommendations(activity, briefing, companies, pipelines);
  }, [activity, briefing, companies, pipelines, selectedType]);

  if (activity.ActionStatus === "Cancelled") return null;

  const { primary } = recommendations;

  const handleCloseActivity = async () => {
    setClosing(true);
    try {
      await syncActivityUpdate(activity.ActivityID, { ActionStatus: "Completed" });
      router.refresh();
    } finally {
      setClosing(false);
    }
  };

  const handleCreateFollowUp = () => {
    const followUp = recommendations.followUp;
    if (!followUp) return;
    const company = companies.find((row) => row.Title === activity.Company?.Title);
    stashSmartAssistPrefill({
      ActivityType: "Task",
      Subject: followUp.title,
      companyId: company?.CompanyID,
      contactId: activity.Contact?.Title,
      dealId: activity.Deal?.Title,
      planDate: followUp.dueDate,
      knowledgeDraft: {
        Summary: followUp.purpose,
        NextAction: followUp.successCriteria,
        ActionRequired: true,
        ActionStatus: "Planned",
      },
    });
    router.push("/activities");
  };

  return (
    <section className={WORKSPACE_PANEL_SURFACE}>
      <p className={EDITORIAL_LABEL}>Recommended action</p>
      <p className={`mt-2 text-[17px] font-medium text-carbon-blue`}>{primary.actionLabel}</p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <SmartAssistConfidenceLabel confidence={primary.confidence} />
        <span className={EDITORIAL_META}>{primary.confidenceReason}</span>
      </div>

      <p className={`mt-4 ${EDITORIAL_META}`}>
        <span className="text-carbon-blue/60">Reason: </span>
        {primary.reason}
      </p>

      <div className="mt-6">
        {renderArtifact(recommendations, activity, handleCreateFollowUp, handleCloseActivity, closing, () =>
          router.refresh(),
        )}
      </div>

      {recommendations.alternatives.length > 0 ? (
        <div className="mt-6">
          <p className={EDITORIAL_META}>Also consider</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {recommendations.alternatives.map((alt) => (
              <button
                key={alt.actionType}
                type="button"
                onClick={() => onSelectedTypeChange(alt.actionType)}
                className={`text-[13px] font-medium transition-colors ${
                  selectedType === alt.actionType
                    ? "text-upcycle-orange"
                    : "text-carbon-blue/50 hover:text-carbon-blue"
                }`}
              >
                {ACTIVITY_ACTION_LABELS[alt.actionType]}
              </button>
            ))}
            {selectedType ? (
              <button
                type="button"
                onClick={() => onSelectedTypeChange(null)}
                className="text-[13px] font-medium text-carbon-blue/50 hover:text-carbon-blue"
              >
                Reset
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function AssistRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className={EDITORIAL_FIELD_LABEL}>{label}</dt>
      <dd className={`mt-0.5 ${EDITORIAL_BODY}`}>{value}</dd>
    </div>
  );
}

function renderArtifact(
  recommendations: ReturnType<typeof buildActivityActionRecommendations>,
  activity: Activity,
  onCreateFollowUp: () => void,
  onCloseActivity: () => void,
  closing: boolean,
  onScheduled: () => void,
) {
  if (recommendations.email) {
    const { email } = recommendations;
    return (
      <div className="space-y-4">
        <AssistRow label="Subject" value={email.subject} />
        <AssistRow label="Objective" value={email.objective} />
        <div>
          <p className={EDITORIAL_FIELD_LABEL}>Draft email</p>
          <pre className={`mt-2 whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-carbon-blue/75`}>
            {email.body}
          </pre>
        </div>
        <ActionButton
          href={m365ComposeHref(email.to, email.subject, email.body)}
          external
          label="Create Outlook Draft"
        />
      </div>
    );
  }

  if (recommendations.call) {
    const { call } = recommendations;
    return (
      <div className="space-y-4">
        <AssistRow label="Call objective" value={call.objective} />
        <AssistRow label="Desired outcome" value={call.desiredOutcome} />
        <div>
          <p className={EDITORIAL_FIELD_LABEL}>Suggested questions</p>
          <ul className="mt-2 space-y-1">
            {call.suggestedQuestions.map((question) => (
              <li key={question} className={EDITORIAL_BODY}>
                {question}
              </li>
            ))}
          </ul>
        </div>
        {call.contactPhone ? (
          <ActionButton href={telHref(call.contactPhone)} label="Schedule Call" />
        ) : (
          <ActionButton href="/activities" label="Schedule Call" />
        )}
      </div>
    );
  }

  if (recommendations.teamsMeeting) {
    const meeting = recommendations.teamsMeeting;
    return (
      <SmartAssistMeetingDisplay
        meeting={meeting}
        action={
          <ScheduleTeamsMeetingButton activity={activity} meeting={meeting} onScheduled={onScheduled} />
        }
      />
    );
  }

  if (recommendations.followUp) {
    const followUp = recommendations.followUp;
    return (
      <div className="space-y-4">
        <AssistRow label="Activity title" value={followUp.title} />
        <AssistRow label="Due date" value={followUp.dueDateLabel} />
        <AssistRow label="Purpose" value={followUp.purpose} />
        <AssistRow label="Success criteria" value={followUp.successCriteria} />
        <button type="button" onClick={onCreateFollowUp} className={actionButtonClass}>
          Create Follow-Up Activity
        </button>
      </div>
    );
  }

  if (recommendations.escalation) {
    const escalation = recommendations.escalation;
    return (
      <div className="space-y-4">
        <AssistRow label="Objective" value={escalation.objective} />
        <AssistRow label="Subject" value={escalation.subject} />
        <pre className={`whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-carbon-blue/75`}>
          {escalation.body}
        </pre>
        <ActionButton
          href={m365ComposeHref(escalation.to, escalation.subject, escalation.body)}
          external
          label="Escalate via Outlook"
        />
      </div>
    );
  }

  if (recommendations.primary.actionType === "close_activity") {
    return (
      <button
        type="button"
        disabled={closing || activity.ActionStatus === "Completed"}
        onClick={() => void onCloseActivity()}
        className={actionButtonClass}
      >
        {activity.ActionStatus === "Completed" ? "Activity closed" : closing ? "Closing…" : "Close Activity"}
      </button>
    );
  }

  return null;
}

const actionButtonClass =
  "inline-flex items-center border border-upcycle-orange/35 bg-upcycle-orange px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-upcycle-orange/90 disabled:opacity-60";

function ScheduleTeamsMeetingButton({
  activity,
  meeting,
  onScheduled,
}: {
  activity: Activity;
  meeting: PreparedTeamsMeetingAction;
  onScheduled: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleSchedule = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/activities/${encodeURIComponent(activity.ActivityID)}/schedule-teams`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: meeting.title,
            body: formatSmartAssistMeetingForCompose(meeting),
          }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        openUrl?: string;
        teamsComposeUrl?: string;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Could not schedule the Teams meeting.");
      }
      const url = payload.openUrl || payload.teamsComposeUrl;
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
      onScheduled();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not schedule the Teams meeting.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => void handleSchedule()}
        className={actionButtonClass}
      >
        {busy ? "Scheduling…" : "Schedule Teams Meeting"}
      </button>
      {error ? <p className="text-[12px] text-carbon-blue/70">{error}</p> : null}
    </div>
  );
}

function ActionButton({
  href,
  label,
  external = false,
}: {
  href: string;
  label: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className={actionButtonClass}
    >
      {label}
    </a>
  );
}
