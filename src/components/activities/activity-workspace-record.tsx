"use client";

import Link from "next/link";
import type { Activity } from "@/types/activity";
import type { ActivityBriefing } from "@/lib/activity-briefing";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import {
  EDITORIAL_BODY,
  EDITORIAL_DIVIDER,
  EDITORIAL_LABEL,
  EDITORIAL_META,
} from "@/lib/editorial-design-system";

export function ActivityWorkspaceRecord({
  activity,
  briefing,
  relatedActivities,
  hasRecord,
}: {
  activity: Activity;
  briefing: ActivityBriefing;
  relatedActivities: Activity[];
  hasRecord: boolean;
}) {
  const { support } = briefing;
  const discussionSummary =
    support.interactionDetail ??
    activity.Summary?.trim() ??
    activity.ActivityDescription?.trim() ??
    null;

  const recordDecisions = [
    ...(activity.KeyDecisions ?? []),
    ...support.decisions.filter(
      (item) => !(activity.KeyDecisions ?? []).some((decision) => decision === item),
    ),
  ];

  const historyActivities = [...relatedActivities]
    .sort((a, b) => new Date(b.ActivityDate).getTime() - new Date(a.ActivityDate).getTime())
    .slice(0, 8);

  const hasReferences = support.documents.length > 0 || relatedActivities.length > 0;
  const hasHistory = historyActivities.length > 0;
  const hasDecisions = recordDecisions.length > 0 || support.agreements.length > 0;

  if (!hasRecord && !discussionSummary) return null;

  return (
    <section className={`mt-10 ${EDITORIAL_DIVIDER} pt-8`}>
      <p className={EDITORIAL_LABEL}>Record</p>
      <p className={`mt-1 ${EDITORIAL_META}`}>Supporting detail — expand when you need the full history.</p>

      <div className="mt-5 space-y-3">
        {discussionSummary ? (
          <CollapsibleSection title="Discussion summary" tier="nice-to-have">
            <p className={`${EDITORIAL_BODY} leading-[1.65]`}>{discussionSummary}</p>
          </CollapsibleSection>
        ) : null}

        {hasDecisions ? (
          <CollapsibleSection title="Decisions" tier="nice-to-have">
            {recordDecisions.length > 0 ? (
              <RecordList items={recordDecisions} />
            ) : null}
            {support.agreements.length > 0 ? (
              <div className={recordDecisions.length > 0 ? "mt-4" : ""}>
                <p className={EDITORIAL_LABEL}>Agreed actions</p>
                <RecordList items={support.agreements} className="mt-2" />
              </div>
            ) : null}
          </CollapsibleSection>
        ) : null}

        {hasHistory ? (
          <CollapsibleSection title="History" tier="nice-to-have">
            <ul className="space-y-3">
              {historyActivities.map((item) => (
                <li key={item.ActivityID}>
                  <Link
                    href={`/activities/${item.ActivityID}`}
                    className="text-[13px] font-medium text-carbon-blue hover:text-upcycle-orange"
                  >
                    {item.Subject}
                  </Link>
                  <p className={EDITORIAL_META}>
                    {new Date(item.ActivityDate).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                    <span className="mx-1.5 text-carbon-blue/20">·</span>
                    {item.ActivityType}
                    {item.ActionStatus !== "Completed" ? (
                      <>
                        <span className="mx-1.5 text-carbon-blue/20">·</span>
                        {item.ActionStatus}
                      </>
                    ) : null}
                  </p>
                </li>
              ))}
            </ul>
          </CollapsibleSection>
        ) : null}

        {hasReferences ? (
          <CollapsibleSection title="References" tier="nice-to-have">
            {support.documents.length > 0 ? (
              <div>
                <p className={EDITORIAL_LABEL}>Documents</p>
                <RecordList items={support.documents.map((doc) => doc.title)} className="mt-2" />
              </div>
            ) : null}
            {relatedActivities.length > 0 ? (
              <div className={support.documents.length > 0 ? "mt-4" : ""}>
                <p className={EDITORIAL_LABEL}>Linked activities</p>
                <ul className="mt-2 space-y-2">
                  {relatedActivities.map((item) => (
                    <li key={item.ActivityID}>
                      <Link
                        href={`/activities/${item.ActivityID}`}
                        className={`${EDITORIAL_BODY} text-carbon-blue/65 hover:text-upcycle-orange`}
                      >
                        {item.Subject}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {support.stakeholders.length > 0 ? (
              <div className="mt-4">
                <p className={EDITORIAL_LABEL}>Also present</p>
                <ul className="mt-2 space-y-1">
                  {support.stakeholders.map((person) => (
                    <li key={person.name} className={`${EDITORIAL_BODY} text-carbon-blue/70`}>
                      {person.name}
                      {person.role ? (
                        <span className="text-carbon-blue/45"> — {person.role}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {support.additionalRisks.length > 0 ? (
              <div className="mt-4">
                <p className={EDITORIAL_LABEL}>Watch points</p>
                <RecordList items={support.additionalRisks} className="mt-2" />
              </div>
            ) : null}
          </CollapsibleSection>
        ) : null}
      </div>
    </section>
  );
}

function RecordList({ items, className = "" }: { items: string[]; className?: string }) {
  return (
    <ul className={`space-y-2 ${className}`}>
      {items.map((item) => (
        <li key={item} className={`${EDITORIAL_BODY} text-carbon-blue/75`}>
          {item}
        </li>
      ))}
    </ul>
  );
}
