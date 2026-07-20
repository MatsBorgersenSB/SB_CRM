"use client";

import Link from "next/link";
import { formatRelativeTime } from "@/lib/relative-time";
import { getWelcomeGreeting } from "@/lib/relationship-intelligence";
import type { AuthUser } from "@/types/auth";
import type { RelationshipCommandCenter } from "@/lib/relationship-intelligence";
import type { DailyBriefing } from "@/types/smartcrm-copilot";
import { NEXT_BEST_ACTION_PRIORITY_STYLES } from "@/lib/next-best-action-engine";
import { company360Href } from "@/types/company-360";
import { ImpactContext } from "@/components/ui/impact-context";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { IntelligenceLead } from "@/components/ui/intelligence-lead";

type DashboardFocusProps = {
  data: RelationshipCommandCenter;
  briefing: DailyBriefing;
  user: AuthUser;
};

export function DashboardFocusLayout({ data, briefing, user }: DashboardFocusProps) {
  const attentionItems = [
    ...data.focusItems.slice(0, 3).map((item) => ({
      id: item.id,
      label: item.title,
      href: item.href,
      critical: item.priority === "critical",
      impact: [item.subtitle],
    })),
    ...data.relationshipsNeedingAttention
      .slice(0, 2)
      .filter((r) => !data.focusItems.some((f) => f.href === r.href))
      .map((item) => ({
        id: item.companyId,
        label: item.companyName,
        href: item.href,
        critical: item.priority === "critical",
        impact: [item.detail],
      })),
  ].slice(0, 4);

  const nextActions = data.nextBestActions.slice(0, 3);
  const recentActivity = data.recentActivities.slice(0, 4);

  const risks = [
    ...briefing.relationshipsAttention.slice(0, 2),
    ...briefing.opportunitiesAtRisk.slice(0, 2),
    ...briefing.knowledgeRisks.slice(0, 2),
  ].slice(0, 5);

  const topAction = nextActions[0];

  return (
    <div className="flex flex-col gap-4">
      <IntelligenceLead
        eyebrow={getWelcomeGreeting(user.displayName)}
        title={briefing.headline}
        summary={
          attentionItems.length > 0
            ? `${attentionItems.length} item${attentionItems.length === 1 ? "" : "s"} need your attention today.`
            : "Your portfolio is on track — no urgent decisions right now."
        }
        action={
          topAction ? (
            <Link
              href={company360Href(topAction.companyId)}
              className={`block border px-4 py-3 transition-opacity hover:opacity-90 ${NEXT_BEST_ACTION_PRIORITY_STYLES[topAction.priority]}`}
            >
              <p className="text-sm font-semibold">{topAction.action}</p>
              <p className="mt-1 text-[11px] opacity-75">{topAction.companyName}</p>
            </Link>
          ) : undefined
        }
      />

      {attentionItems.length > 0 ? (
        <CollapsibleSection title="Attention queue" tier="nice-to-have">
          <ul className="space-y-3">
            {attentionItems.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="group block border border-carbon-blue/8 px-4 py-3 transition-colors hover:border-upcycle-orange/25 hover:bg-upcycle-orange/[0.02]"
                >
                  <p className="text-sm font-medium text-carbon-blue group-hover:text-upcycle-orange">
                    {item.label}
                  </p>
                  <ImpactContext items={item.impact} />
                </Link>
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      ) : null}

      {nextActions.length > 1 ? (
        <CollapsibleSection
          title={`${nextActions.length - 1} more recommended action${nextActions.length === 2 ? "" : "s"}`}
          tier="nice-to-have"
        >
          <ul className="space-y-3">
            {nextActions.slice(1).map((item) => (
              <li key={`${item.companyId}-${item.ruleId}`}>
                <Link
                  href={company360Href(item.companyId)}
                  className={`block border px-4 py-3 ${NEXT_BEST_ACTION_PRIORITY_STYLES[item.priority]}`}
                >
                  <p className="text-sm font-semibold">{item.action}</p>
                  <p className="mt-1 text-[11px] opacity-75">{item.companyName}</p>
                </Link>
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      ) : null}

      {risks.length > 0 ? (
        <CollapsibleSection title="Risks" description="Expand for full risk list" tier="nice-to-have">
          <ul className="space-y-3">
            {risks.map((item) => (
              <li key={item.id}>
                <Link href={item.href ?? "/intelligence"} className="group block hover:opacity-90">
                  <p
                    className={`text-sm font-medium ${
                      item.severity === "critical" ? "text-red-700" : "text-upcycle-orange"
                    }`}
                  >
                    {item.label}
                  </p>
                  <ImpactContext items={[item.detail]} />
                </Link>
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      ) : null}

      {recentActivity.length > 0 ? (
        <CollapsibleSection title="Recent activity" tier="expert">
          <ul className="space-y-2">
            {recentActivity.map((activity) => (
              <li key={activity.ActivityID}>
                <Link
                  href={`/activities/${activity.ActivityID}`}
                  className="text-sm text-carbon-blue/70 hover:text-upcycle-orange"
                >
                  <span className="font-medium">{activity.Subject}</span>
                  <span className="text-carbon-blue/35">
                    {" "}
                    · {formatRelativeTime(activity.ActivityDate)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      ) : null}
    </div>
  );
}
