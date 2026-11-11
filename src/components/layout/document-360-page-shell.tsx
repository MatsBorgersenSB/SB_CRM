"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams, notFound } from "next/navigation";
import { RoleSwitcher } from "@/components/auth/role-switcher";
import { WorkspaceChrome } from "@/components/layout/workspace-chrome";
import { Document360Shell } from "@/components/smartdocs/document-360-shell";
import { WorkspaceMain } from "@/components/ui/workspace-main";
import { useAuth } from "@/context/auth-context";
import { buildDocument360Snapshot } from "@/lib/document-360-data";
import {
  buildDocumentLocationTrail,
  documentLocationReturnHref,
  parseDocumentLocationFrom,
} from "@/lib/document-location";
import {
  canDeleteSmartDoc,
  filterCompaniesForUser,
  filterPipelinesForUser,
} from "@/lib/permissions";
import { getSmartDocById } from "@/lib/smartdoc-registry";
import { deleteSmartDocRecord } from "@/lib/sync-smartdoc";
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
  const router = useRouter();
  const searchParams = useSearchParams();

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

  const from = useMemo(
    () => parseDocumentLocationFrom(searchParams),
    [searchParams],
  );

  const trail = useMemo(() => {
    if (!snapshot) {
      return buildDocumentLocationTrail({ from: null });
    }
    const record = snapshot.libraryRecord;
    const matchedLinked =
      from?.scope === "contact" && from.contactId
        ? snapshot.contacts.find((contact) => contact.contactId === from.contactId)
        : undefined;
    const matchedCompanyContact =
      from?.scope === "contact" && from.contactId
        ? scopedCompanies
            .flatMap((company) => company.contacts)
            .find((contact) => contact.ContactID === from.contactId)
        : undefined;
    const contactName =
      matchedLinked?.name ||
      (matchedCompanyContact
        ? [matchedCompanyContact.FirstName, matchedCompanyContact.LastName]
            .filter(Boolean)
            .join(" ")
            .trim() || matchedCompanyContact.Title
        : undefined);

    return buildDocumentLocationTrail({
      from,
      labels: {
        companyName: snapshot.businessContext.clientName,
        contactName,
        dealName: snapshot.businessContext.dealName,
        projectName: snapshot.businessContext.projectName,
      },
      ownershipKind: snapshot.businessContext.ownershipKind,
      fallback: {
        companyId: record?.OwnerCompanyId,
        dealId: record?.DealId ?? snapshot.pipeline?.id,
        projectId: record?.LinkedProjectId,
      },
    });
  }, [snapshot, from, scopedCompanies]);

  const handleDocumentDelete = useCallback(async () => {
    if (!snapshot) return;
    const id = snapshot.libraryRecord?.SmartDocID ?? snapshot.header.documentId;
    await deleteSmartDocRecord(id, user.role);

    const record = snapshot.libraryRecord;
    router.push(
      documentLocationReturnHref(from, {
        ownershipKind: snapshot.businessContext.ownershipKind,
        companyId: record?.OwnerCompanyId,
        dealId: record?.DealId ?? snapshot.pipeline?.id,
        projectId: record?.LinkedProjectId,
      }),
    );
    router.refresh();
  }, [router, snapshot, user.role, from]);

  if (!snapshot) notFound();

  const showDelete =
    canDeleteSmartDoc(user.role) && Boolean(snapshot.libraryRecord);

  return (
    <WorkspaceChrome>
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-carbon-blue/8 bg-[var(--dashboard-surface)] px-4">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-carbon-blue/60">
          {trail.scopeLabel}
        </p>
        <RoleSwitcher companies={scopedCompanies} />
      </header>
      <WorkspaceMain>
        <Document360Shell
          snapshot={snapshot}
          trail={trail}
          pipelines={scopedPipelines}
          onDocumentDelete={showDelete ? handleDocumentDelete : undefined}
        />
      </WorkspaceMain>
    </WorkspaceChrome>
  );
}
