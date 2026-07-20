"use client";

import Link from "next/link";
import { useState } from "react";
import { AssistedEverythingPanel } from "@/components/administration/assisted-everything-panel";
import { WorkspaceArchitectConversation } from "@/components/administration/workspace-architect-conversation";
import { IntelligenceLead } from "@/components/ui/intelligence-lead";
import { WorkspaceMain } from "@/components/ui/workspace-main";
import { WorkspacePanel, SmartCRMIcon } from "@/components/ui/smartcrm-icon";
import { WorkspaceStack } from "@/components/ui/workspace-main";
import { writeWorkspaceArchitectSession } from "@/lib/workspace-architect-state";
import {
  ASSISTED_EVERYTHING,
  SMARTCRM_PLATFORM_CONSTITUTION,
  WORKSPACE_ARCHITECT,
} from "@/lib/smart-assist-config";
import type { ConfigurationSnapshot } from "@/types/assisted-configuration";
import type { WorkspaceArchitectSession } from "@/types/workspace-architect";

export function WorkspaceArchitectShell({
  baselineSnapshot,
}: {
  baselineSnapshot: ConfigurationSnapshot;
}) {
  const [session, setSession] = useState<WorkspaceArchitectSession | null>(null);
  const [approving, setApproving] = useState(false);

  const handleDesignReady = (next: WorkspaceArchitectSession) => {
    setSession(next);
  };

  const handleApprove = async () => {
    if (!session?.design) return;
    setApproving(true);
    try {
      const response = await fetch("/api/administration/workspace-architect", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session }),
      });
      if (!response.ok) return;
      const body = (await response.json()) as { session: WorkspaceArchitectSession };
      setSession(body.session);
      writeWorkspaceArchitectSession(body.session);
    } finally {
      setApproving(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-10 flex h-11 shrink-0 items-center border-b border-carbon-blue/8 bg-[var(--dashboard-surface)]/95 px-4 backdrop-blur-sm">
        <div className="flex min-w-0 items-center gap-2 text-[11px] text-carbon-blue/55">
          <Link href="/administration" className="font-semibold hover:text-upcycle-orange">
            Administration
          </Link>
          <span className="text-carbon-blue/25">/</span>
          <SmartCRMIcon name="edit" size="xs" />
          <span className="truncate font-semibold text-carbon-blue">{WORKSPACE_ARCHITECT.title}</span>
        </div>
      </header>

      <WorkspaceMain>
        <WorkspaceStack>
          <IntelligenceLead
            eyebrow={`SmartAssist · ${ASSISTED_EVERYTHING.title}`}
            title={WORKSPACE_ARCHITECT.title}
            summary={`${WORKSPACE_ARCHITECT.description} ${WORKSPACE_ARCHITECT.mantra}`}
            vitals={[
              {
                label: "Current architecture",
                value: `${baselineSnapshot.readinessScore}%`,
              },
              {
                label: "Platform",
                value: SMARTCRM_PLATFORM_CONSTITUTION.platform,
              },
              {
                label: "Your role",
                value: "Describe business",
                highlight: true,
              },
              {
                label: "SmartAssist role",
                value: "Design workspace",
              },
            ]}
            action={
              <Link
                href="/administration/assisted-configuration"
                className="inline-flex border border-carbon-blue/15 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-carbon-blue/60 hover:border-upcycle-orange/30 hover:text-upcycle-orange"
              >
                View architecture audit
              </Link>
            }
          />

          <AssistedEverythingPanel compact />

          <WorkspacePanel title="Business Discovery" id="discovery">
            <p className="mb-4 text-sm text-carbon-blue/55">
              {WORKSPACE_ARCHITECT.openingMessage} {WORKSPACE_ARCHITECT.discoveryIntro}
            </p>
            <WorkspaceArchitectConversation onDesignReady={handleDesignReady} />
          </WorkspacePanel>

          <WorkspacePanel title="Implementation Details" collapsible defaultCollapsed>
            <p className="mb-3 text-sm text-carbon-blue/55">{WORKSPACE_ARCHITECT.principle}</p>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
              You never need to configure
            </p>
            <div className="flex flex-wrap gap-2">
              {WORKSPACE_ARCHITECT.hiddenImplementationDetails.map((detail) => (
                <span
                  key={detail}
                  className="border border-carbon-blue/10 bg-carbon-blue/[0.03] px-2 py-1 text-[10px] font-medium text-carbon-blue/50"
                >
                  {detail}
                </span>
              ))}
            </div>
          </WorkspacePanel>

          {session?.design ? (
            <WorkspacePanel title="Approve Design">
              <p className="mb-4 text-sm text-carbon-blue/55">
                Review the generated workspace design above. Approve when ready — SmartAssist will
                guide you through each resolution path.
              </p>
              <button
                type="button"
                disabled={approving || session.design.approved}
                onClick={() => void handleApprove()}
                className="border border-upcycle-orange bg-upcycle-orange px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {session.design.approved
                  ? "Design approved"
                  : approving
                    ? "Recording approval…"
                    : "Approve workspace design"}
              </button>
            </WorkspacePanel>
          ) : null}
        </WorkspaceStack>
      </WorkspaceMain>
    </>
  );
}
