"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileText,
  User,
  Workflow,
} from "lucide-react";
import { ActivityTypeIcon } from "@/components/activities/activity-type-icon";
import {
  formatActivityDateTime,
  formatDueDate,
  isFollowUpOverdue,
} from "@/lib/activity-utils";
import { buildRelationshipMemory } from "@/lib/relationship-memory";
import type { Activity } from "@/types/activity";

type ActivityCardProps = {
  activity: Activity;
  onSelect?: (activity: Activity) => void;
  compact?: boolean;
  defaultExpanded?: boolean;
  /** Timeline rail — show connector dot */
  showRail?: boolean;
  isLastInGroup?: boolean;
};

function MemorySection({
  label,
  children,
  accent,
}: {
  label: string;
  children: React.ReactNode;
  accent?: "orange" | "red" | "neutral";
}) {
  const border =
    accent === "orange"
      ? "border-upcycle-orange/30"
      : accent === "red"
        ? "border-red-500/30"
        : "border-carbon-blue/10";

  return (
    <div className={`border-l-2 pl-3 ${border}`}>
      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/40">
        {label}
      </p>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function LinkChip({
  href,
  icon: Icon,
  label,
  mono,
}: {
  href?: string;
  icon: typeof User;
  label: string;
  mono?: boolean;
}) {
  const className = `inline-flex items-center gap-1 border border-carbon-blue/10 bg-carbon-blue/[0.02] px-2 py-0.5 text-[10px] font-medium text-carbon-blue/65 transition-colors hover:border-upcycle-orange/25 hover:text-upcycle-orange ${
    mono ? "font-mono text-[9px]" : ""
  }`;

  if (href) {
    return (
      <Link href={href} className={className}>
        <Icon className="size-2.5 shrink-0 opacity-60" strokeWidth={2} />
        {label}
      </Link>
    );
  }

  return (
    <span className={className}>
      <Icon className="size-2.5 shrink-0 opacity-60" strokeWidth={2} />
      {label}
    </span>
  );
}

export function ActivityCard({
  activity,
  onSelect,
  compact = false,
  showRail = false,
  isLastInGroup = false,
}: ActivityCardProps) {
  const memory = buildRelationshipMemory(activity);
  const overdue = isFollowUpOverdue(activity);
  const detailHref = `/activities/${activity.ActivityID}`;

  const titleContent = (
    <span className="text-sm font-semibold text-carbon-blue transition-colors group-hover:text-upcycle-orange">
      {activity.Subject}
    </span>
  );

  return (
    <div className={`relative flex gap-3 ${showRail ? "pl-1" : ""}`}>
      {showRail ? (
        <div className="flex flex-col items-center pt-4">
          <span
            className={`z-[1] size-2.5 shrink-0 rounded-full border-2 border-white ${
              overdue
                ? "bg-red-500"
                : memory.whatHappensNext
                  ? "bg-upcycle-orange"
                  : "bg-carbon-blue/25"
            }`}
          />
          {!isLastInGroup ? (
            <span className="w-px flex-1 bg-carbon-blue/12" aria-hidden />
          ) : null}
        </div>
      ) : null}

      <article
        className={`group min-w-0 flex-1 border border-carbon-blue/10 bg-white transition-all duration-200 ease-out hover:border-carbon-blue/18 hover:shadow-[0_4px_24px_-8px_rgba(31,28,36,0.1)] motion-reduce:transition-none ${
          showRail ? "mb-3" : ""
        }`}
      >
        <div className="p-4">
          <div className="flex gap-3">
            {!showRail ? <ActivityTypeIcon type={activity.ActivityType} size="md" /> : null}

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-carbon-blue/45">
                      {activity.ActivityType}
                    </span>
                    {activity.Company?.Title ? (
                      <>
                        <span className="text-carbon-blue/20">·</span>
                        <span className="text-[10px] font-medium text-carbon-blue/55">
                          {activity.Company.Title}
                        </span>
                      </>
                    ) : null}
                  </div>

                  {onSelect ? (
                    <button
                      type="button"
                      onClick={() => onSelect(activity)}
                      className="mt-0.5 block text-left"
                    >
                      {titleContent}
                    </button>
                  ) : (
                    <Link href={detailHref} className="mt-0.5 block">
                      {titleContent}
                    </Link>
                  )}

                  <p className="mt-0.5 text-[10px] text-carbon-blue/40">
                    {formatActivityDateTime(activity.ActivityDate)}
                    {activity.ActivityOwner?.Title ? (
                      <>
                        <span className="mx-1.5">·</span>
                        {activity.ActivityOwner.Title}
                      </>
                    ) : null}
                  </p>
                </div>

                {overdue ? (
                  <span className="shrink-0 border border-red-500/30 bg-red-500/8 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-red-700">
                    Overdue
                  </span>
                ) : memory.whatHappensNext ? (
                  <span className="shrink-0 border border-upcycle-orange/25 bg-upcycle-orange/8 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-upcycle-orange">
                    Action due
                  </span>
                ) : null}
              </div>

              {!compact ? (
                <div className="mt-4 space-y-3">
                  <MemorySection label="What happened">
                    <p className="text-xs leading-relaxed text-carbon-blue/75">
                      {memory.summary}
                    </p>
                    {memory.whatHappened !== memory.summary ? (
                      <p className="mt-1.5 text-[11px] leading-relaxed text-carbon-blue/55">
                        {memory.whatHappened}
                      </p>
                    ) : null}
                  </MemorySection>

                  {memory.decisions.length > 0 ? (
                    <MemorySection label="Decisions" accent="orange">
                      <ul className="space-y-1">
                        {memory.decisions.map((item) => (
                          <li
                            key={item}
                            className="flex items-start gap-2 text-xs text-carbon-blue/75"
                          >
                            <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-upcycle-orange/70" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </MemorySection>
                  ) : null}

                  {memory.commitments.length > 0 ? (
                    <MemorySection label="Commitments">
                      <ul className="space-y-1">
                        {memory.commitments.map((action) => (
                          <li
                            key={action.text}
                            className="flex items-start gap-2 text-xs text-carbon-blue/75"
                          >
                            <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-emerald-600/70" />
                            {action.text}
                          </li>
                        ))}
                      </ul>
                    </MemorySection>
                  ) : null}

                  {memory.whatHappensNext ? (
                    <MemorySection
                      label="What happens next"
                      accent={overdue ? "red" : "orange"}
                    >
                      <p className="text-xs font-medium text-carbon-blue">
                        {memory.whatHappensNext}
                      </p>
                      {memory.whatHappensNextDue ? (
                        <p className="mt-0.5 text-[10px] text-carbon-blue/50">
                          Due {formatDueDate(memory.whatHappensNextDue)}
                        </p>
                      ) : null}
                    </MemorySection>
                  ) : null}

                  {memory.risks.length > 0 ? (
                    <MemorySection label="Risks" accent="red">
                      <ul className="space-y-1">
                        {memory.risks.map((risk) => (
                          <li
                            key={risk}
                            className="flex items-start gap-2 text-xs text-red-700/85"
                          >
                            <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                            {risk}
                          </li>
                        ))}
                      </ul>
                    </MemorySection>
                  ) : null}
                </div>
              ) : (
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-carbon-blue/65">
                  {memory.summary}
                </p>
              )}

              {(memory.linkedContacts.length > 0 ||
                memory.linkedDeals.length > 0 ||
                memory.linkedDocuments.length > 0) && (
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-carbon-blue/6 pt-3">
                  {memory.linkedContacts.map((contact) => (
                    <LinkChip
                      key={contact.Title}
                      href="/contacts"
                      icon={User}
                      label={contact.Title}
                    />
                  ))}
                  {memory.linkedDeals.map((deal) => (
                    <LinkChip
                      key={deal.Title}
                      href="/deals"
                      icon={Workflow}
                      label={deal.Title}
                      mono
                    />
                  ))}
                  {memory.linkedDocuments.map((doc) => (
                    <LinkChip
                      key={doc.Title}
                      icon={FileText}
                      label={doc.Title}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {!compact ? (
          <footer className="border-t border-carbon-blue/6 px-4 py-2">
            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(activity)}
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-carbon-blue/40 transition-colors hover:text-upcycle-orange"
              >
                Full context
                <ArrowRight className="size-3" />
              </button>
            ) : (
              <Link
                href={detailHref}
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-carbon-blue/40 transition-colors hover:text-upcycle-orange"
              >
                Full context
                <ArrowRight className="size-3" />
              </Link>
            )}
          </footer>
        ) : null}
      </article>
    </div>
  );
}
