"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { notFound } from "next/navigation";
import { RoleSwitcher } from "@/components/auth/role-switcher";
import { Deal360LivingWorkspace } from "@/components/opportunity/deal-360-living-workspace";
import { WorkspaceChrome } from "@/components/layout/workspace-chrome";
import { WorkspaceMain } from "@/components/ui/workspace-main";
import { useAuth } from "@/context/auth-context";
import type { Company } from "@/types/company";
import {
  filterCompaniesForUser,
  filterPipelinesForUser,
  canManageOpportunityStakeholders,
} from "@/lib/permissions";
import { buildDealAttentionItems } from "@/lib/smart-attention-engine";
import { syncPipelineRecord } from "@/lib/sync-pipeline";
import type { Activity } from "@/types/activity";
import type { CommercialPackage } from "@/types/commercial-package";
import type { PipelineRow } from "@/types/pipeline";
import { isOpportunityActionTab } from "@/types/opportunity-actions";
import { isOpportunityWorkspaceTab } from "@/types/opportunity-workspace";

export function Deal360PageShell({
  dealId,
  companies,
  pipelines,
  activities,
  commercialPackages,
}: {
  dealId: string;
  companies: Company[];
  pipelines: PipelineRow[];
  activities: Activity[];
  commercialPackages: CommercialPackage[];
}) {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get("tab");

  const scopedCompanies = useMemo(
    () => filterCompaniesForUser(companies, user),
    [companies, user],
  );
  const scopedPipelines = useMemo(
    () => filterPipelinesForUser(pipelines, user, companies),
    [pipelines, user, companies],
  );

  const initialPipeline = scopedPipelines.find((row) => row.id === dealId);
  const [pipeline, setPipeline] = useState(initialPipeline);

  useEffect(() => {
    setPipeline(scopedPipelines.find((row) => row.id === dealId));
  }, [scopedPipelines, dealId]);

  const attentionItems = useMemo(() => {
    if (!pipeline) return [];
    return buildDealAttentionItems(
      pipeline.id,
      scopedCompanies,
      scopedPipelines,
      activities,
      commercialPackages,
    );
  }, [pipeline, scopedCompanies, scopedPipelines, activities, commercialPackages]);

  const handleAssignTeamMember = useCallback(
    async (contactId: string, projectRole: string) => {
      if (!pipeline || !canManageOpportunityStakeholders(user.role)) return;

      const team = [...(pipeline.team ?? []), { contactId, projectRole }];
      const updated = await syncPipelineRecord(pipeline.id, { team }, user.role);
      setPipeline(updated);
    },
    [pipeline, user.role],
  );

  const handleRemoveTeamMember = useCallback(
    async (contactId: string) => {
      if (!pipeline || !canManageOpportunityStakeholders(user.role)) return;

      const team = (pipeline.team ?? []).filter((member) => member.contactId !== contactId);
      const updated = await syncPipelineRecord(pipeline.id, { team }, user.role);
      setPipeline(updated);
    },
    [pipeline, user.role],
  );

  const handleUpdateTeamMemberRole = useCallback(
    async (contactId: string, projectRole: string) => {
      if (!pipeline || !canManageOpportunityStakeholders(user.role)) return;

      const team = (pipeline.team ?? []).map((member) =>
        member.contactId === contactId ? { ...member, projectRole } : member,
      );
      const updated = await syncPipelineRecord(pipeline.id, { team }, user.role);
      setPipeline(updated);
    },
    [pipeline, user.role],
  );

  const handlePipelinePatch = useCallback(
    async (patch: Partial<PipelineRow>) => {
      if (!pipeline) return;
      const updated = await syncPipelineRecord(pipeline.id, patch, user.role);
      setPipeline(updated);
    },
    [pipeline, user.role],
  );

  useEffect(() => {
    if (!tabParam) return;
    const aliases: Record<string, string> = {
      overview: "",
      intelligence: "view=understanding",
      knowledge: "view=understanding",
      viability: "view=actions&action=activities",
      cvm: "view=actions&action=activities",
      commercial: "view=actions&action=activities",
    };
    const resolved = aliases[tabParam];
    if (resolved !== undefined) {
      const url = resolved
        ? `/deals/${dealId}?${resolved}`
        : `/deals/${dealId}`;
      router.replace(url, { scroll: false });
      return;
    }
    if (isOpportunityActionTab(tabParam) && !searchParams.get("view")) {
      router.replace(`/deals/${dealId}?view=actions&action=${tabParam}`, { scroll: false });
      return;
    }
    if (isOpportunityWorkspaceTab(tabParam) && !searchParams.get("view")) {
      router.replace(`/deals/${dealId}?view=actions&action=${tabParam}`, { scroll: false });
    }
  }, [tabParam, dealId, router, searchParams]);

  if (!pipeline) {
    notFound();
  }

  return (
    <WorkspaceChrome>
        <header className="sticky top-0 z-10 flex h-11 shrink-0 items-center justify-between border-b border-carbon-blue/8 bg-[var(--dashboard-surface)]/95 px-4 backdrop-blur-sm">
          <div className="min-w-0 truncate text-[11px] text-carbon-blue/50">
            <Link
              href="/opportunities"
              className="font-medium text-carbon-blue/45 transition-colors hover:text-upcycle-orange"
            >
              Opportunities
            </Link>
          </div>
          <RoleSwitcher companies={scopedCompanies} />
        </header>

        <WorkspaceMain>
          <Deal360LivingWorkspace
            pipeline={pipeline}
            companies={scopedCompanies}
            pipelines={scopedPipelines}
            commercialPackages={commercialPackages}
            activities={activities}
            attentionItems={attentionItems}
            dealTeam={{
              team: pipeline.team ?? [],
              onAssign: handleAssignTeamMember,
              onRemove: handleRemoveTeamMember,
              onUpdateRole: handleUpdateTeamMemberRole,
              readOnly: !canManageOpportunityStakeholders(user.role),
            }}
            role={user.role}
            onPipelinePatch={handlePipelinePatch}
          />
        </WorkspaceMain>
    </WorkspaceChrome>
  );
}
