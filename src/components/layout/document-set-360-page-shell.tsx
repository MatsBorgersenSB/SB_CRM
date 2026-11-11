"use client";

import { useMemo } from "react";
import { useSearchParams, notFound } from "next/navigation";
import { RoleSwitcher } from "@/components/auth/role-switcher";
import { WorkspaceChrome } from "@/components/layout/workspace-chrome";
import { DocumentSet360Shell } from "@/components/smartdocs/document-set-360-shell";
import { WorkspaceMain } from "@/components/ui/workspace-main";
import { useAuth } from "@/context/auth-context";
import {
  buildDocumentSet360Snapshot,
  findDocumentSetById,
} from "@/lib/document-set-engine";
import {
  buildDocumentLocationTrail,
  parseDocumentLocationFrom,
} from "@/lib/document-location";
import { filterCompaniesForUser } from "@/lib/permissions";
import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { CommercialPackage } from "@/types/commercial-package";
import type { PipelineRow } from "@/types/pipeline";
import type { SmartDocLibraryRecord } from "@/types/smartdoc-library";

export function DocumentSet360PageShell({
  setId,
  companies,
  pipelines,
  activities: _activities,
  library,
  commercialPackages,
}: {
  setId: string;
  companies: Company[];
  pipelines: PipelineRow[];
  activities: Activity[];
  library: SmartDocLibraryRecord[];
  commercialPackages: CommercialPackage[];
}) {
  const { user } = useAuth();
  const searchParams = useSearchParams();

  const scopedCompanies = useMemo(
    () => filterCompaniesForUser(companies, user),
    [companies, user],
  );

  const from = useMemo(
    () => parseDocumentLocationFrom(searchParams),
    [searchParams],
  );

  const snapshot = useMemo(() => {
    const documentSet = findDocumentSetById(setId, commercialPackages, companies, pipelines);
    if (!documentSet) return null;
    return buildDocumentSet360Snapshot(
      documentSet,
      library,
      commercialPackages,
      pipelines,
      from,
    );
  }, [setId, commercialPackages, companies, pipelines, library, from]);

  const trail = useMemo(() => {
    if (!snapshot) return buildDocumentLocationTrail({ from: null });
    return buildDocumentLocationTrail({
      from,
      labels: {
        companyName: snapshot.documentSet.clientName,
        dealName: snapshot.documentSet.dealName,
      },
      ownershipKind: "opportunity",
      fallback: {
        companyId: snapshot.documentSet.companyId,
        dealId: snapshot.documentSet.dealId,
      },
    });
  }, [snapshot, from]);

  if (!snapshot) notFound();

  return (
    <WorkspaceChrome>
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-carbon-blue/8 bg-[var(--dashboard-surface)] px-4">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-carbon-blue/60">
          {trail.scopeLabel}
        </p>
        <RoleSwitcher companies={scopedCompanies} />
      </header>
      <WorkspaceMain>
        <DocumentSet360Shell snapshot={snapshot} trail={trail} />
      </WorkspaceMain>
    </WorkspaceChrome>
  );
}
