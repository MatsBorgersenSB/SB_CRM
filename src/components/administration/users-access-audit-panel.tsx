"use client";

import { UserAccessGapCard } from "@/components/administration/user-access-gap-card";
import { WorkspacePanel } from "@/components/ui/smartcrm-icon";
import { ASSISTANT_ACTIONABILITY } from "@/lib/smart-assist-config";
import type { UsersAccessAudit } from "@/types/user-access";

export function UsersAccessAuditPanel({ audit }: { audit: UsersAccessAudit }) {
  return (
    <WorkspacePanel
      title="SmartAssist Access Audit"
      collapsible
      defaultCollapsed={false}
      count={audit.gaps.length}
    >
      <p className="mb-4 text-sm text-carbon-blue/55">
        {ASSISTANT_ACTIONABILITY.mandate} {ASSISTANT_ACTIONABILITY.rule} Each gap includes a direct
        resolution path — no dead-end recommendations.
      </p>

      {audit.gaps.length === 0 ? (
        <p className="text-sm text-carbon-blue/50">{audit.summary}</p>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {audit.gaps.map((gap) => (
            <UserAccessGapCard key={gap.id} gap={gap} />
          ))}
        </div>
      )}
    </WorkspacePanel>
  );
}
