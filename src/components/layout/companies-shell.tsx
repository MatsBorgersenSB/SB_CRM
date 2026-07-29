"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RoleSwitcher } from "@/components/auth/role-switcher";
import { CompaniesActionBar } from "@/components/companies/companies-action-bar";
import { WebsiteDiscoveryPanel } from "@/components/companies/website-discovery-panel";
import { CompanyDirectory } from "@/components/companies/company-directory";
import { WorkspaceChrome } from "@/components/layout/workspace-chrome";
import { useAuth } from "@/context/auth-context";
import type { Company } from "@/lib/companies-data";
import { filterCompaniesForUser } from "@/lib/permissions";
import { buildCompanySummariesForCompanies } from "@/lib/relationship-intelligence";
import type { Activity } from "@/types/activity";
import type { PipelineRow } from "@/types/pipeline";
import { company360Href } from "@/types/company-360";

type CompaniesShellProps = {
  companies: Company[];
  pipelines: PipelineRow[];
  activities: Activity[];
};

export function CompaniesShell({
  companies,
  pipelines,
  activities,
}: CompaniesShellProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [companyRows, setCompanyRows] = useState(companies);

  const visibleCompanies = useMemo(
    () => filterCompaniesForUser(companyRows, user),
    [companyRows, user],
  );

  const summaries = useMemo(
    () => buildCompanySummariesForCompanies(visibleCompanies, activities, pipelines),
    [visibleCompanies, activities, pipelines],
  );

  const handleSelectCompany = useCallback(
    (companyId: string) => {
      router.push(company360Href(companyId));
    },
    [router],
  );

  const handleCompanyCreated = useCallback(
    (company: Company) => {
      setCompanyRows((current) => {
        const exists = current.some((record) => record.CompanyID === company.CompanyID);
        if (exists) {
          return current.map((record) =>
            record.CompanyID === company.CompanyID ? company : record,
          );
        }
        return [...current, company];
      });
      router.push(company360Href(company));
    },
    [router],
  );

  const handleDiscoveryImported = useCallback(
    (company: Company) => {
      setCompanyRows((current) => {
        const exists = current.some((record) => record.CompanyID === company.CompanyID);
        if (exists) {
          return current.map((record) =>
            record.CompanyID === company.CompanyID ? company : record,
          );
        }
        return [...current, company];
      });
      router.refresh();
    },
    [router],
  );

  return (
    <WorkspaceChrome>
        <header className="flex h-11 shrink-0 items-center justify-between border-b border-carbon-blue/8 bg-[var(--dashboard-surface)] px-4">
          <h1 className="text-sm font-semibold text-carbon-blue">Companies</h1>
          <div className="flex items-center gap-3">
            <RoleSwitcher companies={companyRows} />
            <span className="border border-upcycle-orange/30 bg-upcycle-orange/10 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-upcycle-orange">
              {visibleCompanies.length}
            </span>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 sm:p-8">
          <div className="mx-auto flex max-w-4xl flex-col gap-6">
            <WebsiteDiscoveryPanel role={user.role} onImported={handleDiscoveryImported} />
            <CompaniesActionBar
              onCreated={handleCompanyCreated}
              role={user.role}
              companies={visibleCompanies}
            />
            <CompanyDirectory summaries={summaries} onSelect={handleSelectCompany} />
          </div>
        </main>
    </WorkspaceChrome>
  );
}
