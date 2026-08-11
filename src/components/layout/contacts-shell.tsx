"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RoleSwitcher } from "@/components/auth/role-switcher";
import { BulkImportPanel } from "@/components/companies/bulk-import-panel";
import { QuickImportPanel } from "@/components/companies/quick-import-panel";
import { WebsiteDiscoveryPanel } from "@/components/companies/website-discovery-panel";
import { ContactsActionBar } from "@/components/contacts/contacts-action-bar";
import { ContactsInsightsPanel } from "@/components/contacts/contacts-insights-panel";
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
import { WorkspacePanel, SmartCRMIcon } from "@/components/ui/smartcrm-icon";
import { useAuth } from "@/context/auth-context";
import { useWorkspaceFilterBridge } from "@/hooks/use-workspace-filter-bridge";
import { buildContactOperationsSummary } from "@/lib/contact-operations-data";
import type { Company, Contact } from "@/lib/companies-data";
import { getGlobalContactRecords } from "@/lib/contact-utils";
import { filterCompaniesForUser } from "@/lib/permissions";
import { getContactDisplayName } from "@/types/contact";
import { CONTACT_LIST_ROLES, CONTACT_STATUSES, RELATIONSHIP_LEVELS } from "@/types/contact";
import type { Activity } from "@/types/activity";
import type { OutlookEvidenceRecord } from "@/types/outlook-reconciliation";
import type { PipelineRow } from "@/types/pipeline";
import { contact360Href } from "@/types/relationship-navigation";
import type { FilterDefinition, FilterSummaryChip, WorkspaceFilterValues } from "@/types/workspace-filters";
import { normalizeMultiFilter, normalizeSingleFilter } from "@/types/workspace-filters";

type ContactsShellProps = {
  companies: Company[];
  pipelines: PipelineRow[];
  activities: Activity[];
  outlookEvidence: OutlookEvidenceRecord[];
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
}: ContactsShellProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [companyRows, setCompanyRows] = useState(companies);
  const [pipelineRows] = useState(pipelines);
  const [toolbarFilters, setToolbarFilters] = useState<WorkspaceFilterValues>(DEFAULT_FILTERS);
  const [search, setSearch] = useState("");
  const [owner, setOwner] = useState("all");
  const [activeTool, setActiveTool] = useState<ContactsWorkspaceTool>(null);
  const [showArchived, setShowArchived] = useState(false);

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

  const summary = useMemo(
    () => buildContactOperationsSummary(contactRecords, activities),
    [contactRecords, activities],
  );

  const ownerOptions = useMemo(() => {
    const labels = new Set<string>();
    for (const company of scopedCompanies) {
      if (company.AccountOwner?.Title) labels.add(company.AccountOwner.Title);
    }
    return Array.from(labels)
      .sort()
      .map((label) => ({ value: label, label }));
  }, [scopedCompanies]);

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

  const filteredRecords = useMemo(() => {
    const companiesFilter = normalizeMultiFilter(toolbarFilters.company);
    const roles = normalizeMultiFilter(toolbarFilters.role);
    const status = normalizeSingleFilter(toolbarFilters.status, "all");
    const relationship = normalizeSingleFilter(toolbarFilters.relationship, "all");
    const q = search.trim().toLowerCase();

    return contactRecords.filter((record) => {
      if (!showArchived && record.contact.IsArchived) return false;

      const accountOwner = scopedCompanies.find((c) => c.CompanyID === record.companyId)
        ?.AccountOwner?.Title;
      if (companiesFilter.length > 0 && !companiesFilter.includes(record.companyId)) {
        return false;
      }
      if (roles.length > 0 && !roles.includes(record.contact.Role)) return false;
      if (status !== "all" && record.contact.Status !== status) return false;
      if (relationship !== "all" && record.contact.RelationshipLevel !== relationship) {
        return false;
      }
      if (owner !== "all" && accountOwner?.toLowerCase() !== owner.toLowerCase()) {
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
  }, [contactRecords, toolbarFilters, search, owner, scopedCompanies, showArchived]);

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

  return (
    <WorkspaceChrome>
      <header className="sticky top-0 z-10 flex h-11 shrink-0 items-center justify-between border-b border-carbon-blue/8 bg-[var(--dashboard-surface)]/95 px-4 backdrop-blur-sm">
        <div className="flex min-w-0 items-center gap-2 text-[11px] text-carbon-blue/55">
          <SmartCRMIcon name="contact" size="xs" />
          <span className="font-semibold text-carbon-blue">Contacts</span>
        </div>
        <RoleSwitcher companies={companyRows} />
      </header>

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
                searchPlaceholder="Search contacts…"
                owners={ownerOptions}
                ownerValue={owner}
                onOwnerChange={setOwner}
                entityLabel="Contacts"
                totalCount={availableContactCount}
                filteredCount={filteredRecords.length}
                defaultValues={DEFAULT_FILTERS}
                extraActiveFilters={archivedFilterChip ? [archivedFilterChip] : undefined}
                onClearAll={handleClearAllFilters}
              />
              <label className="mt-2 flex items-center gap-2 px-6 text-[11px] text-carbon-blue/55">
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(event) => setShowArchived(event.target.checked)}
                />
                Show archived contacts
              </label>
            </div>
            <ContactsOperationsTable records={filteredRecords} activities={activities} />
          </WorkspacePanel>

          <WorkspacePanel title="Relationship Intelligence" id="relationship-intelligence" collapsible>
            <ContactRelationshipPortfolioPanel
              companies={scopedCompanies}
              pipelines={pipelineRows}
              activities={activities}
            />
          </WorkspacePanel>

          <ContactsInsightsPanel summary={summary} />

          <WorkspacePanel title="Outlook Reconciliation" id="reconciliation" collapsible defaultCollapsed>
            <MissingTouchpointsPanel
              companies={scopedCompanies}
              pipelines={pipelineRows}
              activities={activities}
              outlookEvidence={outlookEvidence}
            />
          </WorkspacePanel>
        </WorkspaceStack>
      </WorkspaceMain>
    </WorkspaceChrome>
  );
}
