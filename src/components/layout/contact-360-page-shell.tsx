"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Contact360LivingWorkspace } from "@/components/contacts/contact-360-living-workspace";
import { WorkspaceChrome } from "@/components/layout/workspace-chrome";
import { WorkspaceMain } from "@/components/ui/workspace-main";
import { useAuth } from "@/context/auth-context";
import type { Company } from "@/lib/companies-data";
import { findContactByContactId } from "@/lib/contact-utils";
import { filterCompaniesForUser, filterPipelinesForUser } from "@/lib/permissions";
import {
  archiveContactRecord,
  deleteContactRecord,
  syncCompanyContact,
} from "@/lib/sync-company";
import { buildContactAttentionItems } from "@/lib/smart-attention-engine";
import type { Activity } from "@/types/activity";
import type { CommercialPackage } from "@/types/commercial-package";
import type { OutlookEvidenceRecord } from "@/types/outlook-reconciliation";
import { getContactDisplayName, type UpdateContactInput } from "@/types/contact";
import type { EditableContactField as EditableContactFieldName } from "@/types/contact";
import type { PipelineRow } from "@/types/pipeline";
import type { Project } from "@/types/project";

type Contact360PageShellProps = {
  contactId: string;
  companies: Company[];
  pipelines: PipelineRow[];
  activities: Activity[];
  commercialPackages: CommercialPackage[];
  outlookEvidence: OutlookEvidenceRecord[];
  projects: Project[];
};

export function Contact360PageShell({
  contactId,
  companies,
  pipelines,
  activities,
  commercialPackages,
  outlookEvidence,
  projects,
}: Contact360PageShellProps) {
  const router = useRouter();
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const companyHint = searchParams.get("company") ?? undefined;
  const lifecycleAction = searchParams.get("lifecycle");
  const reconcileAction = searchParams.get("reconcile");

  const [companyRows, setCompanyRows] = useState(companies);
  const [activityRows, setActivityRows] = useState(activities);
  const [evidenceRows, setEvidenceRows] = useState(outlookEvidence);
  const [projectRows, setProjectRows] = useState(projects);
  const [pipelineRows, setPipelineRows] = useState(pipelines);

  useEffect(() => {
    setCompanyRows(companies);
  }, [companies]);

  useEffect(() => {
    setPipelineRows(pipelines);
  }, [pipelines]);

  useEffect(() => {
    setActivityRows(activities);
  }, [activities]);

  useEffect(() => {
    setEvidenceRows(outlookEvidence);
  }, [outlookEvidence]);

  useEffect(() => {
    setProjectRows(projects);
  }, [projects]);

  const handleProjectUpdated = useCallback((updated: Project) => {
    setProjectRows((current) => {
      const exists = current.some((row) => row.id === updated.id);
      if (!exists) return [...current, updated];
      return current.map((row) => (row.id === updated.id ? updated : row));
    });
  }, []);

  const handlePipelineUpdated = useCallback((updated: PipelineRow) => {
    setPipelineRows((current) => {
      const exists = current.some((row) => row.id === updated.id);
      if (!exists) return [...current, updated];
      return current.map((row) => (row.id === updated.id ? updated : row));
    });
  }, []);

  const scopedCompanies = useMemo(
    () => filterCompaniesForUser(companyRows, user),
    [companyRows, user],
  );
  const scopedPipelines = useMemo(
    () => filterPipelinesForUser(pipelineRows, user, companyRows),
    [pipelineRows, user, companyRows],
  );

  const record = useMemo(
    () =>
      findContactByContactId(scopedCompanies, scopedPipelines, contactId, companyHint),
    [scopedCompanies, scopedPipelines, contactId, companyHint],
  );

  const company = useMemo(
    () => scopedCompanies.find((c) => c.CompanyID === record?.companyId),
    [scopedCompanies, record?.companyId],
  );

  const attentionItems = useMemo(() => {
    if (!record) return [];
    return buildContactAttentionItems(
      record.contact.ContactID,
      record.companyId,
      scopedCompanies,
      scopedPipelines,
      activityRows,
      commercialPackages,
    );
  }, [record, scopedCompanies, scopedPipelines, activityRows, commercialPackages]);

  const handleReconciliationImported = useCallback(() => {
    router.refresh();
    void fetch("/api/activities")
      .then(async (response) => {
        if (!response.ok) return;
        const rows = (await response.json()) as Activity[];
        if (Array.isArray(rows)) setActivityRows(rows);
      })
      .catch(() => undefined);
    void fetch("/api/m365/reconciliation")
      .then(async (response) => {
        if (!response.ok) return;
        const audit = (await response.json()) as { missingTouchpoints: unknown[] };
        if (audit.missingTouchpoints.length === 0) {
          setEvidenceRows((current) =>
            current.map((row) => ({ ...row, reconciledAt: row.reconciledAt ?? new Date().toISOString() })),
          );
        }
      })
      .catch(() => undefined);
  }, [router]);

  const replaceContactInCompanies = useCallback(
    (contactIdToReplace: string, updated: Company["contacts"][number], targetCompanyId?: string) => {
      setCompanyRows((current) =>
        current.map((row) => {
          let contacts = row.contacts;

          if (targetCompanyId && row.CompanyID === record?.companyId) {
            contacts = contacts.filter((contact) => contact.ContactID !== contactIdToReplace);
          } else if (!targetCompanyId || row.CompanyID === record?.companyId) {
            contacts = contacts.map((contact) =>
              contact.ContactID === contactIdToReplace ? updated : contact,
            );
          }

          if (targetCompanyId && row.CompanyID === targetCompanyId) {
            const exists = contacts.some((contact) => contact.ContactID === updated.ContactID);
            contacts = exists
              ? contacts.map((contact) =>
                  contact.ContactID === updated.ContactID ? updated : contact,
                )
              : [...contacts, updated];
          }

          return { ...row, contacts };
        }),
      );
    },
    [record?.companyId],
  );

  const handleContactFieldCommit = useCallback(
    async (id: string, field: EditableContactFieldName, value: string) => {
      if (!record) return;
      const updated = await syncCompanyContact(record.companyId, id, { [field]: value });
      replaceContactInCompanies(id, updated);
    },
    [record, replaceContactInCompanies],
  );

  const handleContactUpdate = useCallback(
    async (id: string, patch: UpdateContactInput) => {
      if (!record) return;
      const updated = await syncCompanyContact(record.companyId, id, patch);
      replaceContactInCompanies(id, updated);
    },
    [record, replaceContactInCompanies],
  );

  const handleContactDelete = useCallback(
    async (id: string) => {
      if (!record) return;
      await deleteContactRecord(id, user.role);
      setCompanyRows((current) =>
        current.map((row) =>
          row.CompanyID === record.companyId
            ? {
                ...row,
                contacts: row.contacts.filter((contact) => contact.ContactID !== id),
              }
            : row,
        ),
      );
      router.push("/contacts");
    },
    [record, router, user.role],
  );

  const handleContactArchive = useCallback(
    async (id: string, archived: boolean) => {
      const updated = await archiveContactRecord(id, archived);
      replaceContactInCompanies(id, updated);
    },
    [replaceContactInCompanies],
  );

  const handleContactTransferred = useCallback(
    (updated: Company["contacts"][number], targetCompanyId: string) => {
      replaceContactInCompanies(updated.ContactID, updated, targetCompanyId);
      router.replace(
        `/contacts/${encodeURIComponent(updated.ContactID)}?company=${encodeURIComponent(targetCompanyId)}`,
      );
    },
    [replaceContactInCompanies, router],
  );

  const handleContactMerged = useCallback(
    (updated: Company["contacts"][number], removedContactId: string) => {
      setCompanyRows((current) =>
        current.map((row) => ({
          ...row,
          contacts: row.contacts
            .filter((contact) => contact.ContactID !== removedContactId)
            .map((contact) =>
              contact.ContactID === updated.ContactID ? updated : contact,
            ),
        })),
      );
    },
    [],
  );

  if (!record || !company) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--dashboard-bg)] text-sm text-carbon-blue/55">
        Contact not found.
      </div>
    );
  }

  const displayName = getContactDisplayName(record.contact);

  return (
    <WorkspaceChrome>
      <header className="sticky top-0 z-10 flex h-11 shrink-0 items-center justify-between border-b border-carbon-blue/8 bg-[var(--dashboard-surface)]/95 px-4 backdrop-blur-sm">
        <div className="min-w-0 truncate text-[11px] text-carbon-blue/55">
          <Link href="/contacts" className="font-semibold text-carbon-blue/45 hover:text-upcycle-orange">
            Contacts
          </Link>
          <span className="text-carbon-blue/25"> / </span>
          <span className="font-semibold text-carbon-blue">{displayName}</span>
          {record.contact.IsArchived ? (
            <span className="ml-2 border border-carbon-blue/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/45">
              Archived
            </span>
          ) : null}
        </div>
      </header>

      <WorkspaceMain>
        <Contact360LivingWorkspace
          record={record}
          company={company}
          pipelines={scopedPipelines}
          companies={scopedCompanies}
          activities={activityRows}
          commercialPackages={commercialPackages}
          outlookEvidence={evidenceRows}
          attentionItems={attentionItems}
          role={user.role}
          lifecycleAction={lifecycleAction}
          reconcileAction={reconcileAction}
          onContactFieldCommit={handleContactFieldCommit}
          onContactUpdate={handleContactUpdate}
          onContactDelete={handleContactDelete}
          onContactArchive={handleContactArchive}
          onContactTransferred={handleContactTransferred}
          onContactMerged={handleContactMerged}
          onReconciliationImported={handleReconciliationImported}
          projects={projectRows}
          onProjectUpdated={handleProjectUpdated}
          onPipelineUpdated={handlePipelineUpdated}
        />
      </WorkspaceMain>
    </WorkspaceChrome>
  );
}
