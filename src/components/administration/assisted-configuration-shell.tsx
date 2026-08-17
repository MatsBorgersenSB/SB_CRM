"use client";

import Link from "next/link";
import { AssistedEverythingPanel } from "@/components/administration/assisted-everything-panel";
import { ConfigRecommendationCard } from "@/components/administration/config-recommendation-card";
import { PlatformArchitecturePanel } from "@/components/administration/platform-architecture-panel";
import { IntelligenceLead } from "@/components/ui/intelligence-lead";
import { WorkspaceMain } from "@/components/ui/workspace-main";
import { WorkspacePanel, SmartCRMIcon } from "@/components/ui/smartcrm-icon";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { WorkspaceStack } from "@/components/ui/workspace-main";
import { ASSISTED_CONFIGURATION, ASSISTED_EVERYTHING, ASSISTANT_ACTIONABILITY, WORKSPACE_ARCHITECT } from "@/lib/smart-assist-config";
import type { ConfigurationSnapshot } from "@/types/assisted-configuration";

function ReadinessBadge({ score }: { score: number }) {
  const tone =
    score >= 90
      ? "border-upcycle-orange/30 bg-upcycle-orange/10 text-upcycle-orange"
      : score >= 70
        ? "border-carbon-blue/15 bg-carbon-blue/[0.04] text-carbon-blue"
        : "border-thermal-red/25 bg-thermal-red/[0.06] text-thermal-red";

  return (
    <span className={`border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${tone}`}>
      {score}% architecture
    </span>
  );
}

export function AssistedConfigurationShell({
  snapshot,
}: {
  snapshot: ConfigurationSnapshot;
}) {
  return (
    <>
      <header className="sticky top-0 z-10 flex h-11 shrink-0 items-center justify-between border-b border-carbon-blue/8 bg-[var(--dashboard-surface)]/95 px-4 backdrop-blur-sm">
        <div className="flex min-w-0 items-center gap-2 text-[11px] text-carbon-blue/55">
          <Link href="/administration" className="font-semibold hover:text-upcycle-orange">
            Administration
          </Link>
          <span className="text-carbon-blue/25">/</span>
          <SmartCRMIcon name="edit" size="xs" />
          <span className="truncate font-semibold text-carbon-blue">Workspace Architecture</span>
        </div>
        <ThemeToggle />
      </header>

      <WorkspaceMain>
        <WorkspaceStack>
          <IntelligenceLead
            eyebrow={`SmartAssist · ${ASSISTED_EVERYTHING.title}`}
            title={snapshot.readinessLabel}
            status={<ReadinessBadge score={snapshot.readinessScore} />}
            summary={`${snapshot.primaryGap} ${ASSISTED_EVERYTHING.mantra}`}
            vitals={snapshot.vitals}
            action={
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/administration/workspace-architect"
                  className="inline-flex border border-upcycle-orange bg-upcycle-orange px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white"
                >
                  {WORKSPACE_ARCHITECT.title}
                </Link>
                {snapshot.primaryActionHref ? (
                  <Link
                    href={snapshot.primaryActionHref}
                    className="inline-flex border border-carbon-blue/15 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-carbon-blue/60 hover:border-upcycle-orange/30 hover:text-upcycle-orange"
                  >
                    {snapshot.primaryAction}
                  </Link>
                ) : null}
              </div>
            }
          />

          <AssistedEverythingPanel compact />

          <WorkspacePanel title="Platform Architecture" collapsible defaultCollapsed={false}>
            <PlatformArchitecturePanel layers={snapshot.architectureLayers} />
          </WorkspacePanel>

          <WorkspacePanel title="Governance Domains" collapsible defaultCollapsed={false}>
            <p className="mb-4 text-sm text-carbon-blue/55">
              {ASSISTED_EVERYTHING.smartAssistRole}{" "}
              {ASSISTED_CONFIGURATION.workspaceDesign} {snapshot.objective}
            </p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {snapshot.domains.map((domain) => (
                <div
                  key={domain.domain}
                  className={`border p-4 ${
                    domain.healthy
                      ? "border-carbon-blue/10 bg-carbon-blue/[0.02]"
                      : "border-upcycle-orange/20 bg-upcycle-orange/[0.03]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-carbon-blue/45">
                      {domain.label}
                    </p>
                    <span className="text-[11px] font-bold tabular-nums text-carbon-blue/60">
                      {domain.score}%
                    </span>
                  </div>
                  <p className="mt-2 text-[12px] leading-relaxed text-carbon-blue/70">{domain.summary}</p>
                  {domain.recommendationCount > 0 ? (
                    <p className="mt-2 text-[10px] font-medium text-upcycle-orange">
                      {domain.recommendationCount} recommendation
                      {domain.recommendationCount === 1 ? "" : "s"}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </WorkspacePanel>

          <WorkspacePanel
            title="Architecture Recommendations"
            collapsible
            count={snapshot.recommendations.length}
          >
            <p className="mb-4 text-sm text-carbon-blue/55">
              {ASSISTANT_ACTIONABILITY.mandate}{" "}
              {ASSISTANT_ACTIONABILITY.rule} Every recommendation includes{" "}
              {ASSISTANT_ACTIONABILITY.requiredFields.join(", ")}.
            </p>
            {snapshot.recommendations.length > 0 ? (
              <div className="grid gap-4 xl:grid-cols-2">
                {snapshot.recommendations.map((recommendation) => (
                  <ConfigRecommendationCard key={recommendation.id} recommendation={recommendation} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-carbon-blue/45">
                Workspace architecture is aligned. SmartAssist will recommend changes as your
                business capabilities evolve.
              </p>
            )}
          </WorkspacePanel>
        </WorkspaceStack>
      </WorkspaceMain>
    </>
  );
}
