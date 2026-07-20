"use client";

import { useMemo } from "react";
import { notFound } from "next/navigation";
import { RoleSwitcher } from "@/components/auth/role-switcher";
import { WorkspaceChrome } from "@/components/layout/workspace-chrome";
import { Document360Shell } from "@/components/smartdocs/document-360-shell";
import { WorkspaceMain } from "@/components/ui/workspace-main";
import { useAuth } from "@/context/auth-context";
import { buildDocument360Snapshot } from "@/lib/document-360-data";
import {
  filterCompaniesForUser,
  filterPipelinesForUser,
} from "@/lib/permissions";
import { getSmartDocById } from "@/lib/smartdoc-registry";
import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type { SmartDocLibraryRecord } from "@/types/smartdoc-library";
import type { CommercialPackage } from "@/types/commercial-package";

export function Document360PageShell({
  documentId,
  companies,
  pipelines,
  activities,
  library = [],
  commercialPackages = [],
}: {
  documentId: string;
  companies: Company[];
  pipelines: PipelineRow[];
  activities: Activity[];
  library?: SmartDocLibraryRecord[];
  commercialPackages?: CommercialPackage[];
}) {
  const { user } = useAuth();

  const scopedCompanies = useMemo(
    () => filterCompaniesForUser(companies, user),
    [companies, user],
  );
  const scopedPipelines = useMemo(
    () => filterPipelinesForUser(pipelines, user, companies),
    [pipelines, user, companies],
  );

  const document = useMemo(
    () => getSmartDocById(documentId, scopedPipelines, activities, library),
    [documentId, scopedPipelines, activities, library],
  );

  const snapshot = useMemo(() => {
    if (!document) return null;
    return buildDocument360Snapshot(
      document,
      scopedPipelines,
      scopedCompanies,
      activities,
      library,
      commercialPackages,
    );
  }, [document, scopedPipelines, scopedCompanies, activities, library, commercialPackages]);

  if (!snapshot) notFound();

  return (
    <WorkspaceChrome>
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-carbon-blue/8 bg-[var(--dashboard-surface)] px-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            SmartDocs
          </p>
          <RoleSwitcher companies={scopedCompanies} />
        </header>
        <WorkspaceMain>
          <Document360Shell snapshot={snapshot} />
        </WorkspaceMain>
    </WorkspaceChrome>
  );
}
