"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { RoleSwitcher } from "@/components/auth/role-switcher";
import { Company360LivingWorkspace } from "@/components/company-360/company-360-living-workspace";
import { WorkspaceChrome } from "@/components/layout/workspace-chrome";
import { WorkspaceMain } from "@/components/ui/workspace-main";
import { useAuth } from "@/context/auth-context";
import type { Company360Snapshot } from "@/lib/company-360-data";
import { buildCompany360Snapshot } from "@/lib/company-360-data";
import {
  canCreateOpportunity,
  canManageOpportunityStakeholders,
  filterCompaniesForUser,
  filterPipelinesForUser,
} from "@/lib/permissions";
import { createContactRecord, deleteContactRecord, syncCompanyContact, archiveContactRecord } from "@/lib/sync-company";
import { createDealRecord, syncPipelineRecord } from "@/lib/sync-pipeline";
import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { CreateContactInput, UpdateContactInput } from "@/types/contact";
import type { CreateOpportunityInput } from "@/types/deal";
import { company360Href } from "@/types/company-360";
import type { CommercialPackage } from "@/types/commercial-package";
import type { InventoryDb } from "@/lib/inventory-data";
import type { PipelineRow } from "@/types/pipeline";
import type { Project } from "@/types/project";
import { buildCompanyAttentionItems } from "@/lib/smart-attention-engine";

type Company360ShellProps = {
  initialCompany: Company;
  companies: Company[];
  pipelines: PipelineRow[];
  activities: Activity[];
  inventory: InventoryDb;
  commercialPackages: CommercialPackage[];
  projects: Project[];
};

export function Company360Shell({
  initialCompany,
  companies,
  pipelines,
  activities,
  inventory,
  commercialPackages,
  projects,
}: Company360ShellProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const [companyRows, setCompanyRows] = useState(companies);
  const [company, setCompany] = useState(initialCompany);
  const [pipelineRows, setPipelineRows] = useState(pipelines);
  const [projectRows, setProjectRows] = useState(projects);

  useEffect(() => {
    setPipelineRows(pipelines);
  }, [pipelines]);

  useEffect(() => {
    setProjectRows(projects);
  }, [projects]);

  useEffect(() => {
    setCompanyRows(companies);
  }, [companies]);

  useEffect(() => {
    setCompany(initialCompany);
  }, [initialCompany]);

  const tabParam = searchParams.get("tab");

  useEffect(() => {
    if (!tabParam || tabParam === "overview") return;

    if (tabParam === "intelligence" || tabParam === "graph") {
      router.replace("/intelligence", { scroll: false });
      return;
    }

    if (tabParam === "documents") {
      router.replace(company360Href(company.CompanyID, "documents"), { scroll: false });
      return;
    }

    const section =
      tabParam === "people" || tabParam === "contacts"
        ? "contacts"
        : tabParam === "activities"
          ? "activities"
          : tabParam === "pipeline" || tabParam === "deals" || tabParam === "materials"
            ? "opportunities"
            : tabParam === "attention" || tabParam === "next-action"
              ? "attention"
              : null;

    if (section) {
      router.replace(company360Href(company.CompanyID, section), { scroll: false });
    } else {
      router.replace(company360Href(company.CompanyID), { scroll: false });
    }
  }, [tabParam, company.CompanyID, router]);

  const visibleCompanies = useMemo(
    () => filterCompaniesForUser(companyRows, user),
    [companyRows, user],
  );

  const visiblePipelines = useMemo(
    () => filterPipelinesForUser(pipelineRows, user, companyRows),
    [pipelineRows, user, companyRows],
  );

  const scopedActivities = useMemo(() => {
    if (user.role !== "client_lead" || !user.companyId) return activities;
    if (user.companyId !== company.CompanyID) return [];
    return activities;
  }, [activities, company.CompanyID, user]);

  const snapshot: Company360Snapshot = useMemo(
    () =>
      buildCompany360Snapshot(company, visiblePipelines, scopedActivities, inventory),
    [company, visiblePipelines, scopedActivities, inventory],
  );

  const attentionItems = useMemo(
    () =>
      buildCompanyAttentionItems(
        company,
        visiblePipelines,
        scopedActivities,
        commercialPackages,
        companyRows,
      ),
    [company, visiblePipelines, scopedActivities, commercialPackages, companyRows],
  );

  const handleCreateContact = useCallback(
    async (input: CreateContactInput) => {
      const contact = await createContactRecord(company.CompanyID, {
        ...input,
        Company: { CompanyID: company.CompanyID },
      });

      const appendContact = (record: Company): Company => ({
        ...record,
        contacts: [...record.contacts, contact],
      });

      setCompanyRows((current) =>
        current.map((record) =>
          record.CompanyID === company.CompanyID ? appendContact(record) : record,
        ),
      );
      setCompany((current) => appendContact(current));
    },
    [company.CompanyID],
  );

  const handleContactUpdate = useCallback(
    async (contactId: string, patch: UpdateContactInput) => {
      const updated = await syncCompanyContact(company.CompanyID, contactId, patch);

      const replaceContact = (record: Company): Company => ({
        ...record,
        contacts: record.contacts.map((contact) =>
          contact.ContactID === contactId ? updated : contact,
        ),
      });

      setCompanyRows((current) =>
        current.map((record) =>
          record.CompanyID === company.CompanyID ? replaceContact(record) : record,
        ),
      );
      setCompany((current) => replaceContact(current));
    },
    [company.CompanyID],
  );

  const handleContactDelete = useCallback(
    async (contactId: string) => {
      await deleteContactRecord(contactId, user.role);

      const removeContact = (record: Company): Company => ({
        ...record,
        contacts: record.contacts.filter((contact) => contact.ContactID !== contactId),
      });

      setCompanyRows((current) =>
        current.map((record) =>
          record.CompanyID === company.CompanyID ? removeContact(record) : record,
        ),
      );
      setCompany((current) => removeContact(current));
    },
    [company.CompanyID, user.role],
  );

  const handleContactReassign = useCallback(
    async (contactId: string, targetCompanyId: string) => {
      const updated = await syncCompanyContact(company.CompanyID, contactId, {
        Company: { CompanyID: targetCompanyId },
      });

      const removeContact = (record: Company): Company => ({
        ...record,
        contacts: record.contacts.filter((contact) => contact.ContactID !== contactId),
      });

      const appendContact = (record: Company): Company => ({
        ...record,
        contacts: [...record.contacts, updated],
      });

      setCompanyRows((current) =>
        current.map((record) => {
          if (record.CompanyID === company.CompanyID) return removeContact(record);
          if (record.CompanyID === targetCompanyId) return appendContact(record);
          return record;
        }),
      );
      setCompany((current) => removeContact(current));
    },
    [company.CompanyID],
  );

  const handleContactArchive = useCallback(
    async (contactId: string, archived: boolean) => {
      const updated = await archiveContactRecord(contactId, archived);

      const replaceContact = (record: Company): Company => ({
        ...record,
        contacts: record.contacts.map((contact) =>
          contact.ContactID === contactId ? updated : contact,
        ),
      });

      setCompanyRows((current) =>
        current.map((record) =>
          record.CompanyID === company.CompanyID ? replaceContact(record) : record,
        ),
      );
      setCompany((current) => replaceContact(current));
    },
    [company.CompanyID],
  );

  const handleCompanyUpdated = useCallback((updated: Company) => {
    setCompanyRows((current) =>
      current.map((record) =>
        record.CompanyID === updated.CompanyID ? updated : record,
      ),
    );
    setCompany((current) =>
      current.CompanyID === updated.CompanyID ? updated : current,
    );
  }, []);

  const handleProjectUpdated = useCallback((updated: Project) => {
    setProjectRows((current) => {
      const exists = current.some((row) => row.id === updated.id);
      if (!exists) return [...current, updated];
      return current.map((row) => (row.id === updated.id ? updated : row));
    });
  }, []);

  const handleCreateOpportunity = useCallback(
    async (input: CreateOpportunityInput) => {
      if (!canCreateOpportunity(user.role)) {
        throw new Error("You do not have permission to create opportunities");
      }
      const created = await createDealRecord(input, user.role);
      setPipelineRows((current) =>
        current.some((deal) => deal.id === created.id) ? current : [...current, created],
      );
      setCompany((current) => {
        if (current.pipelineIds.includes(created.id)) return current;
        return { ...current, pipelineIds: [...current.pipelineIds, created.id] };
      });
      setCompanyRows((current) =>
        current.map((record) =>
          record.CompanyID === input.companyId && !record.pipelineIds.includes(created.id)
            ? { ...record, pipelineIds: [...record.pipelineIds, created.id] }
            : record,
        ),
      );
      return created;
    },
    [user.role],
  );

  const handleAssignOpportunityStakeholder = useCallback(
    async (dealId: string, contactId: string, projectRole: string) => {
      if (!canManageOpportunityStakeholders(user.role)) {
        throw new Error("You do not have permission to manage stakeholders");
      }
      const deal = pipelineRows.find((row) => row.id === dealId);
      const team = [...(deal?.team ?? []), { contactId, projectRole }];
      const updated = await syncPipelineRecord(dealId, { team }, user.role);
      setPipelineRows((current) =>
        current.map((row) => (row.id === dealId ? updated : row)),
      );
      return updated;
    },
    [pipelineRows, user.role],
  );

  return (
    <WorkspaceChrome>
        <header className="sticky top-0 z-10 flex h-11 shrink-0 items-center justify-between border-b border-carbon-blue/8 bg-[var(--dashboard-surface)]/95 px-4 backdrop-blur-sm">
          <div className="min-w-0 truncate text-[11px] text-carbon-blue/55">
            <Link href="/companies" className="font-semibold text-carbon-blue/45 hover:text-upcycle-orange">
              Companies
            </Link>
            <span className="text-carbon-blue/25"> / </span>
            <span className="font-semibold text-carbon-blue">{company.Title}</span>
          </div>
          <RoleSwitcher companies={visibleCompanies} />
        </header>

        <WorkspaceMain>
          <Company360LivingWorkspace
            snapshot={snapshot}
            commercialPackages={commercialPackages}
            scopedActivities={scopedActivities}
            attentionItems={attentionItems}
            companies={companyRows}
            role={user.role}
            onCreateContact={handleCreateContact}
            onContactUpdate={handleContactUpdate}
            onContactDelete={handleContactDelete}
            onContactReassign={handleContactReassign}
            onContactArchive={handleContactArchive}
            onCompanyUpdated={handleCompanyUpdated}
            projects={projectRows}
            onProjectUpdated={handleProjectUpdated}
            allPipelines={visiblePipelines}
            onCreateOpportunity={handleCreateOpportunity}
            onAssignOpportunityStakeholder={handleAssignOpportunityStakeholder}
          />
        </WorkspaceMain>
    </WorkspaceChrome>
  );
}
