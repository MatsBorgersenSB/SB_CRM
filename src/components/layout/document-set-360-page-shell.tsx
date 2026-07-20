"use client";

import { useMemo } from "react";
import { notFound } from "next/navigation";
import { RoleSwitcher } from "@/components/auth/role-switcher";
import { WorkspaceChrome } from "@/components/layout/workspace-chrome";
import { DocumentSet360Shell } from "@/components/smartdocs/document-set-360-shell";
import { WorkspaceMain } from "@/components/ui/workspace-main";
import { useAuth } from "@/context/auth-context";
import {
  buildDocumentSet360Snapshot,
  findDocumentSetById,
} from "@/lib/document-set-engine";
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
  activities,
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

  const scopedCompanies = useMemo(
    () => filterCompaniesForUser(companies, user),
    [companies, user],
  );

  const snapshot = useMemo(() => {
    const documentSet = findDocumentSetById(setId, commercialPackages, companies, pipelines);
    if (!documentSet) return null;
    return buildDocumentSet360Snapshot(documentSet, library, commercialPackages, pipelines);
  }, [setId, commercialPackages, companies, pipelines, library]);

  if (!snapshot) notFound();

  return (
    <WorkspaceChrome>
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-carbon-blue/8 bg-[var(--dashboard-surface)] px-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            Document Sets
          </p>
          <RoleSwitcher companies={scopedCompanies} />
        </header>
        <WorkspaceMain>
          <DocumentSet360Shell snapshot={snapshot} />
        </WorkspaceMain>
    </WorkspaceChrome>
  );
}
