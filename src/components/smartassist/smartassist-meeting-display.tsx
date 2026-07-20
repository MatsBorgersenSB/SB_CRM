"use client";

import type { ReactNode } from "react";
import type { SmartAssistMeeting } from "@/types/smartassist-meeting";
import {
  EDITORIAL_BODY,
  EDITORIAL_FIELD_LABEL,
  EDITORIAL_LABEL,
  EDITORIAL_META,
  EDITORIAL_TITLE,
} from "@/lib/editorial-design-system";
import { EditorialPanel } from "@/components/ui/editorial-primitives";

type SmartAssistMeetingDisplayProps = {
  meeting: SmartAssistMeeting;
  /** Optional action row — e.g. Schedule Teams Meeting button */
  action?: ReactNode;
  /** Panel wrapper for workspace assist views */
  variant?: "inline" | "panel";
  panelLabel?: string;
};

export function SmartAssistMeetingDisplay({
  meeting,
  action,
  variant = "inline",
  panelLabel = "Prepared meeting",
}: SmartAssistMeetingDisplayProps) {
  const content = (
    <>
      {variant === "panel" ? (
        <p className={EDITORIAL_LABEL}>{panelLabel}</p>
      ) : null}

      <p className={variant === "panel" ? `mt-3 ${EDITORIAL_TITLE}` : `text-[17px] font-medium text-carbon-blue`}>
        {meeting.title}
      </p>

      <p className={`mt-1 ${EDITORIAL_META}`}>{meeting.purposeLabel}</p>

      <MeetingSection label="Meeting objective" value={meeting.objective} />

      <div className="mt-5">
        <p className={EDITORIAL_FIELD_LABEL}>Agenda</p>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5">
          {meeting.agenda.map((item) => (
            <li key={item} className={EDITORIAL_BODY}>
              {item}
            </li>
          ))}
        </ol>
      </div>

      <MeetingList label="Decisions required" items={meeting.decisionsRequired} />

      <div className="mt-5">
        <p className={EDITORIAL_FIELD_LABEL}>Desired outcome</p>
        <ul className="mt-2 space-y-1.5">
          {meeting.desiredOutcomes.map((item) => (
            <li key={item} className={`flex gap-2 ${EDITORIAL_BODY}`}>
              <span className="shrink-0 text-upcycle-orange" aria-hidden>
                ✓
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <dl className="mt-5 space-y-3">
        <MeetingSection label="Suggested duration" value={meeting.suggestedDuration} />
        <MeetingSection label="Suggested attendees" value={meeting.suggestedAttendees.join(" · ")} />
      </dl>

      {action ? <div className="mt-6">{action}</div> : null}
    </>
  );

  if (variant === "panel") {
    return <EditorialPanel>{content}</EditorialPanel>;
  }

  return <div className="space-y-0">{content}</div>;
}

function MeetingSection({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-5">
      <p className={EDITORIAL_FIELD_LABEL}>{label}</p>
      <p className={`mt-1 ${EDITORIAL_BODY}`}>{value}</p>
    </div>
  );
}

function MeetingList({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-5">
      <p className={EDITORIAL_FIELD_LABEL}>{label}</p>
      <ul className="mt-2 list-disc space-y-1.5 pl-5">
        {items.map((item) => (
          <li key={item} className={EDITORIAL_BODY}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
