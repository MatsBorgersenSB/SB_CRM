"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BulkImportPanel } from "@/components/companies/bulk-import-panel";
import { QuickImportPanel } from "@/components/companies/quick-import-panel";
import { WebsiteDiscoveryPanel } from "@/components/companies/website-discovery-panel";
import { ContactsActionBar } from "@/components/contacts/contacts-action-bar";
import { ContactRelationshipPortfolioPanel } from "@/components/contacts/contact-relationship-portfolio-panel";
import { MissingTouchpointsPanel } from "@/components/m365/missing-touchpoints-panel";
import { ContactsOperationsTable } from "@/components/contacts/contacts-operations-table";
import {
  ContactsWorkspaceHeader,
  type ContactsWorkspaceTool,
} from "@/components/contacts/contacts-workspace-header";
import { WorkspaceChrome } from "@/components/layout/workspace-chrome";
import { FilterToolbar } from "@/components/ui/filter-toolbar";
import { WorkspaceMain, WorkspaceStack } from "@/components/ui/workspace-main";
import { WorkspacePanel } from "@/components/ui/smartcrm-icon";
import { WorkspaceTopBar } from "@/components/ui/workspace-top-bar";
import { useAuth } from "@/context/auth-context";
import { useEscapeKey } from "@/hooks/use-escape-key";
import { useWorkspaceFilterBridge } from "@/hooks/use-workspace-filter-bridge";
import type { Company, Contact } from "@/lib/companies-data";
import { getGlobalContactRecords } from "@/lib/contact-utils";
import {
  lastMailByEmailFromRecord,
  type CorrespondenceByCompanyId,
} from "@/lib/company-correspondence";
import { formatAccountOwnerDisplay } from "@/lib/company-owner";
import { canReassignContactOwner, filterCompaniesForUser } from "@/lib/permissions";
import { analyzeOutlookReconciliation } from "@/lib/outlook-reconciliation-engine";
import { syncCompanyContact } from "@/lib/sync-company";
import { getContactDisplayName, type UpdateContactInput } from "@/types/contact";
import { CONTACT_LIST_ROLES, CONTACT_STATUSES, RELATIONSHIP_LEVELS } from "@/types/contact";
import type { Activity } from "@/types/activity";
import type { OutlookEvidenceRecord } from "@/types/outlook-reconciliation";
import type { PipelineRow } from "@/types/pipeline";
import { contact360Href } from "@/types/relationship-navigation";
import type { SharePointPerson } from "@/types/company";
import type { StandardBioUserRecord } from "@/types/user-access";
import type { FilterDefinition, FilterSummaryChip, WorkspaceFilterValues } from "@/types/workspace-filters";
import { normalizeMultiFilter, normalizeSingleFilter } from "@/types/workspace-filters";

type ContactsShellProps = {
  companies: Company[];
  pipelines: PipelineRow[];
  activities: Activity[];
  outlookEvidence: OutlookEvidenceRecord[];
  /** Synced Outlook mail recency by CompanyID — gives each person a real last touch. */
  correspondence?: CorrespondenceByCompanyId | null;
  assignableUsers?: StandardBioUserRecord[];
};

const CONTACT_FILTER_KEYS = ["company", "role", "status", "relationship"] as const;

const DEFAULT_FILTERS: WorkspaceFilterValues = {
  company: [],
  role: [],
  status: "all",
  relationship: "all",
};

export function ContactsShell({
  companies,
  pipelines,
  activities,
  outlookEvidence,
  correspondence = null,
  assignableUsers = [],
}: ContactsShellProps) {
  const { user } = useAuth();
  const router = useRouter();
  const lastMailByEmail = useMemo(() => lastMailByEmailFromRecord(correspondence), [correspondence]);
  const [companyRows, setCompanyRows] = useState(companies);
  const [pipelineRows, setPipelineRows] = useState(pipelines);
  const [toolbarFilters, setToolbarFilters] = useState<WorkspaceFilterValues>(DEFAULT_FILTERS);
  const [search, setSearch] = useState("");
  const [owner, setOwner] = useState("all");
  const [activeTool, setActiveTool] = useState<ContactsWorkspaceTool>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [savingOwnerId, setSavingOwnerId] = useState<string | null>(null);

  const closeActiveTool = useCallback(() => setActiveTool(null), []);
  useEscapeKey(Boolean(activeTool), closeActiveTool);

  useEffect(() => {
    setCompanyRows(companies);
  }, [companies]);

  useEffect(() => {
    setPipelineRows(pipelines);
  }, [pipelines]);

  const applyBridge = useCallback(
    (patch: { filters?: WorkspaceFilterValues; search?: string; owner?: string }) => {
      if (patch.filters) setToolbarFilters((current) => ({ ...current, ...patch.filters }));
      if (patch.search !== undefined) setSearch(patch.search);
      if (patch.owner !== undefined) setOwner(patch.owner);
    },
    [],
  );

  useWorkspaceFilterBridge("contacts", [...CONTACT_FILTER_KEYS], applyBridge);

  const scopedCompanies = useMemo(
    () => filterCompaniesForUser(companyRows, user),
    [companyRows, user],
  );

  const contactRecords = useMemo(
    () => getGlobalContactRecords(scopedCompanies, pipelineRows),
    [scopedCompanies, pipelineRows],
  );

  const ownerOptions = useMemo(() => {
    const labels = new Set<string>();
    for (const record of contactRecords) {
      const title = formatAccountOwnerDisplay(record.contact.ContactOwner);
      if (title) labels.add(title);
    }
    return Array.from(labels)
      .sort()
      .map((label) => ({ value: label, label }));
  }, [contactRecords]);

  const roleFilterOptions = useMemo(() => {
    const fromData = contactRecords
      .map((record) => record.contact.Role?.trim())
      .filter(Boolean) as string[];
    return [...new Set([...CONTACT_LIST_ROLES, ...fromData])]
      .sort((a, b) => a.localeCompare(b))
      .map((role) => ({ value: role, label: role }));
  }, [contactRecords]);

  const filterDefinitions = useMemo<FilterDefinition[]>(
    () => [
      {
        id: "company",
        label: "Company",
        mode: "multi",
        options: scopedCompanies.map((company) => ({
          value: company.CompanyID,
          label: company.Title,
        })),
      },
      {
        id: "role",
        label: "Role",
        mode: "multi",
        options: roleFilterOptions,
      },
      {
        id: "status",
        label: "Status",
        mode: "single",
        emptyValue: "all",
        options: CONTACT_STATUSES.map((status) => ({ value: status, label: status })),
      },
      {
        id: "relationship",
        label: "Relationship",
        mode: "single",
        emptyValue: "all",
        options: RELATIONSHIP_LEVELS.map((level) => ({ value: level, label: level })),
      },
    ],
    [scopedCompanies, roleFilterOptions],
  );

  const outlookAudit = useMemo(
    () =>
      analyzeOutlookReconciliation({
        companies: scopedCompanies,
        pipelines: pipelineRows,
        activities,
        outlookEvidence,
      }),
    [scopedCompanies, pipelineRows, activities, outlookEvidence],
  );

  const filteredRecords = useMemo(() => {
    const companiesFilter = normalizeMultiFilter(toolbarFilters.company);
    const roles = normalizeMultiFilter(toolbarFilters.role);
    const status = normalizeSingleFilter(toolbarFilters.status, "all");
    const relationship = normalizeSingleFilter(toolbarFilters.relationship, "all");
    const q = search.trim().toLowerCase();

    return contactRecords.filter((record) => {
      if (!showArchived && record.contact.IsArchived) return false;

      const contactOwner = formatAccountOwnerDisplay(record.contact.ContactOwner);
      if (companiesFilter.length > 0 && !companiesFilter.includes(record.companyId)) {
        return false;
      }
      if (roles.length > 0 && !roles.includes(record.contact.Role)) return false;
      if (status !== "all" && record.contact.Status !== status) return false;
      if (relationship !== "all" && record.contact.RelationshipLevel !== relationship) {
        return false;
      }
      if (owner !== "all" && (contactOwner ?? "").toLowerCase() !== owner.toLowerCase()) {
        return false;
      }
      if (!q) return true;
      const name = getContactDisplayName(record.contact).toLowerCase();
      return (
        name.includes(q) ||
        record.companyName.toLowerCase().includes(q) ||
        record.contact.JobTitle.toLowerCase().includes(q) ||
        record.contact.Email.toLowerCase().includes(q)
      );
    });
  }, [contactRecords, toolbarFilters, search, owner, showArchived]);

  const availableContactCount = useMemo(
    () =>
      contactRecords.filter((record) => showArchived || !record.contact.IsArchived).length,
    [contactRecords, showArchived],
  );

  const archivedFilterChip = useMemo<FilterSummaryChip | undefined>(
    () =>
      showArchived
        ? {
            id: "archived",
            label: "Archived",
            value: "Shown",
            onRemove: () => setShowArchived(false),
          }
        : undefined,
    [showArchived],
  );

  const handleFilterChange = useCallback((id: string, value: string | string[]) => {
    setToolbarFilters((current) => ({ ...current, [id]: value }));
  }, []);

  const handleClearAllFilters = useCallback(() => {
    setToolbarFilters(DEFAULT_FILTERS);
    setSearch("");
    setOwner("all");
    setShowArchived(false);
  }, []);

  const upsertCompany = useCallback((company: Company) => {
    setCompanyRows((current) => {
      const exists = current.some((record) => record.CompanyID === company.CompanyID);
      if (exists) {
        return current.map((record) =>
          record.CompanyID === company.CompanyID ? company : record,
        );
      }
      return [...current, company];
    });
  }, []);

  const handleContactCreated = useCallback(
    (companyId: string, contact: Contact) => {
      setCompanyRows((current) =>
        current.map((company) =>
          company.CompanyID === companyId
            ? { ...company, contacts: [...company.contacts, contact] }
            : company,
        ),
      );
      setActiveTool(null);
      router.push(contact360Href(contact.ContactID, companyId));
    },
    [router],
  );

  const handleImported = useCallback(
    (company: Company) => {
      upsertCompany(company);
      router.refresh();
    },
    [router, upsertCompany],
  );

  // Inline edits from the list (buying role) — persist, then swap the contact in place.
  const handleContactUpdate = useCallback(
    async (companyId: string, contactId: string, patch: UpdateContactInput) => {
      const updated = await syncCompanyContact(companyId, contactId, patch);
      setCompanyRows((current) =>
        current.map((company) =>
          company.CompanyID === companyId
            ? {
                ...company,
                contacts: company.contacts.map((contact) =>
                  contact.ContactID === contactId ? updated : contact,
                ),
              }
            : company,
        ),
      );
    },
    [],
  );

  const handleOwnerChange = useCallback(
    async (companyId: string, contactId: string, owner: SharePointPerson) => {
      setSavingOwnerId(contactId);
      try {
        await handleContactUpdate(companyId, contactId, { ContactOwner: owner });
      } catch (error) {
        console.error("[contacts] Could not change contact owner", error);
      } finally {
        setSavingOwnerId(null);
      }
    },
    [handleContactUpdate],
  );

  return (
    <WorkspaceChrome>
      <WorkspaceTopBar icon="people" title="People" />

      <WorkspaceMain>
        <WorkspaceStack>
          <section className="dashboard-card flex min-h-0 flex-col overflow-hidden p-4 sm:p-6">
            <ContactsWorkspaceHeader
              role={user.role}
              activeTool={activeTool}
              onToolChange={setActiveTool}
            />

            {activeTool === "new-contact" ? (
              <div className="mt-4 border border-carbon-blue/10 bg-white p-3">
                <ContactsActionBar
                  embedded
                  open
                  onOpenChange={(open) => {
                    if (!open) setActiveTool(null);
                  }}
                  companies={scopedCompanies}
                  onCreated={handleContactCreated}
                />
              </div>
            ) : null}

            {activeTool === "quick-import" ? (
              <div className="mt-4">
                <QuickImportPanel
                  embedded
                  role={user.role}
                  companies={companyRows}
                  onImported={handleImported}
                  onRunWebsiteDiscovery={() => setActiveTool("website-discovery")}
                />
              </div>
            ) : null}

            {activeTool === "website-discovery" ? (
              <div className="mt-4">
                <WebsiteDiscoveryPanel
                  embedded
                  role={user.role}
                  companies={companyRows}
                  context="contact"
                  onImported={handleImported}
                />
              </div>
            ) : null}

            {activeTool === "bulk-import" ? (
              <div className="mt-4">
                <BulkImportPanel embedded role={user.role} companies={companyRows} onImported={handleImported} />
              </div>
            ) : null}
          </section>

          <WorkspacePanel title="People" count={filteredRecords.length}>
            <div className="-mx-6 -mt-5 mb-4">
              <FilterToolbar
                filters={filterDefinitions}
                values={toolbarFilters}
                onChange={handleFilterChange}
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder="Search people…"
                owners={ownerOptions}
                ownerValue={owner}
                onOwnerChange={setOwner}
                entityLabel="People"
                totalCount={availableContactCount}
                filteredCount={filteredRecords.length}
                defaultValues={DEFAULT_FILTERS}
                extraActiveFilters={archivedFilterChip ? [archivedFilterChip] : undefined}
                onClearAll={handleClearAllFilters}
              />
              <label className="mt-2 flex items-center gap-2 px-6 text-[12px] text-carbon-blue/55">
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(event) => setShowArchived(event.target.checked)}
                />
                Show archived people
              </label>
            </div>
            <ContactsOperationsTable
              records={filteredRecords}
              activities={activities}
              lastMailByEmail={lastMailByEmail}
              companies={scopedCompanies}
              assignableUsers={assignableUsers}
              canReassignOwner={canReassignContactOwner(user.role)}
              savingOwnerId={savingOwnerId}
              onContactUpdate={handleContactUpdate}
              onOwnerChange={handleOwnerChange}
            />
          </WorkspacePanel>

          <ContactRelationshipPortfolioPanel
            companies={scopedCompanies}
            pipelines={pipelineRows}
            activities={activities}
          />

          {outlookAudit.missingTouchpoints.length > 0 ? (
            <WorkspacePanel
              title="Seen in Outlook, not in SmartCRM"
              count={outlookAudit.missingTouchpoints.length}
              id="reconciliation"
              collapsible
              defaultCollapsed
            >
              <MissingTouchpointsPanel
                companies={scopedCompanies}
                pipelines={pipelineRows}
                activities={activities}
                outlookEvidence={outlookEvidence}
              />
            </WorkspacePanel>
          ) : null}
        </WorkspaceStack>
      </WorkspaceMain>
    </WorkspaceChrome>
  );
}
