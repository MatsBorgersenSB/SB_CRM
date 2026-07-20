"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { RoleSwitcher } from "@/components/auth/role-switcher";
import { ExecutiveKpiRibbon } from "@/components/dashboard/executive-kpi-ribbon";
import { PipelineDetail } from "@/components/data/pipeline-detail";
import { PipelineTable } from "@/components/data/pipeline-table";
import { WorkspaceChrome } from "@/components/layout/workspace-chrome";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { SlideDrawer } from "@/components/ui/slide-drawer";
import { useAuth } from "@/context/auth-context";
import type { Company } from "@/lib/companies-data";
import { computeExecutivePipelineKpis } from "@/lib/pipeline-kpis";
import {
  canAssignDealTeam,
  canUploadSmartDocs,
  canViewExecutiveKpis,
  filterPipelinesForUser,
} from "@/lib/permissions";
import { syncPipelineRecord } from "@/lib/sync-pipeline";
import type { Activity } from "@/types/activity";
import type { PipelineRow } from "@/types/pipeline";
import type { SmartDocLibraryRecord } from "@/types/smartdoc-library";
import { DealDetailPanel } from "@/components/pipelines/deal-detail-panel";

type AppShellProps = {
  initialPipelines: PipelineRow[];
  companies: Company[];
  activities: Activity[];
};

export function AppShell({ initialPipelines, companies, activities }: AppShellProps) {
  const { user } = useAuth();
  const [pipelines, setPipelines] = useState(initialPipelines);
  const [companyRows] = useState(companies);
  const [selected, setSelected] = useState<PipelineRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const visiblePipelines = useMemo(
    () => filterPipelinesForUser(pipelines, user, companyRows),
    [pipelines, user, companyRows],
  );

  const executiveKpis = useMemo(
    () => computeExecutivePipelineKpis(visiblePipelines),
    [visiblePipelines],
  );

  const handleDataChange = useCallback((updatedVisible: PipelineRow[]) => {
    setPipelines((current) => {
      const byId = new Map(updatedVisible.map((row) => [row.id, row]));
      return current.map((row) => byId.get(row.id) ?? row);
    });
  }, []);

  const patchPipeline = useCallback(
    (id: string, patch: Partial<PipelineRow>) => {
      setPipelines((current) =>
        current.map((row) => (row.id === id ? { ...row, ...patch } : row)),
      );
      setSelected((current) =>
        current?.id === id ? { ...current, ...patch } : current,
      );
    },
    [],
  );

  const openDrawer = useCallback((row: PipelineRow) => {
    setSelected(row);
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  const handleRowUpdate = useCallback((row: PipelineRow) => {
    patchPipeline(row.id, row);
  }, [patchPipeline]);

  const handleDocumentCreated = useCallback(
    (record: SmartDocLibraryRecord) => {
      if (!selected) return;
      patchPipeline(selected.id, {
        ClientLookup: record.PlNumber,
        DocCategory: record.DocCategory,
        DocType: record.DocType,
        Revision: record.Revision,
        FileLeafRef: record.FileLeafRef,
      });
    },
    [patchPipeline, selected],
  );

  const handleAssignTeamMember = useCallback(
    async (contactId: string, projectRole: string) => {
      if (!selected || !canAssignDealTeam(user.role)) return;

      const team = [...(selected.team ?? []), { contactId, projectRole }];
      await syncPipelineRecord(selected.id, { team }, user.role);
      patchPipeline(selected.id, { team });
    },
    [patchPipeline, selected, user.role],
  );

  const smartDocsReadOnly = !canUploadSmartDocs(user.role);

  return (
    <>
      <WorkspaceChrome>
        <header className="flex h-11 shrink-0 items-center justify-between border-b border-carbon-blue/15 bg-white px-4">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-semibold text-carbon-blue">Deals</h1>
            <Link
              href="/opportunities"
              className="text-[10px] font-semibold text-upcycle-orange hover:underline"
            >
              Opportunity Command Center
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <RoleSwitcher companies={companyRows} />
            <span className="border border-upcycle-orange/30 bg-upcycle-orange/10 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-upcycle-orange">
              {visiblePipelines.length}
            </span>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-3">
          <div className="flex flex-col gap-3">
            {canViewExecutiveKpis(user.role) ? (
              <CollapsibleSection title="Portfolio metrics" tier="expert">
                <ExecutiveKpiRibbon kpis={executiveKpis} />
              </CollapsibleSection>
            ) : null}
            <PipelineTable
              data={visiblePipelines}
              onDataChange={handleDataChange}
              onSelect={openDrawer}
              onRowUpdate={handleRowUpdate}
              navigationPaused={drawerOpen}
            />
          </div>
        </main>
      </WorkspaceChrome>
      <SlideDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        title={selected?.assetName ?? ""}
        subtitle={selected?.id}
      >
        {selected ? (
          <DealDetailPanel
            pipeline={selected}
            activities={activities}
            companies={companyRows}
            allPipelines={pipelines}
            documents={{
              readOnly: smartDocsReadOnly,
              onDocumentCreated: smartDocsReadOnly ? undefined : handleDocumentCreated,
            }}
            dealTeam={
              canAssignDealTeam(user.role)
                ? {
                    team: selected.team ?? [],
                    onAssign: handleAssignTeamMember,
                  }
                : {
                    team: selected.team ?? [],
                    onAssign: async () => {},
                    readOnly: true,
                  }
            }
          />
        ) : null}
      </SlideDrawer>
    </>
  );
}
