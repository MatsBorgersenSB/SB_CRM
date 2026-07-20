"use client";

import Link from "next/link";
import { RoleSwitcher } from "@/components/auth/role-switcher";
import { CompanyIdentityOverview } from "@/components/companies/company-identity-overview";
import { WorkspaceChrome } from "@/components/layout/workspace-chrome";
import { WorkspaceMain } from "@/components/ui/workspace-main";
import { WorkspacePanel } from "@/components/ui/smartcrm-icon";
import { useAuth } from "@/context/auth-context";
import { buildCompanyHeroIdentity } from "@/lib/company-identity";
import { filterCompaniesForUser } from "@/lib/permissions";
import type { Company } from "@/types/company";

export function CompanyMasterDataShell({ company, companies }: { company: Company; companies: Company[] }) {
  const { user } = useAuth();
  const identity = buildCompanyHeroIdentity(company);
  const visibleCompanies = filterCompaniesForUser(companies, user);

  return (
    <WorkspaceChrome>
        <header className="sticky top-0 z-10 flex h-11 shrink-0 items-center justify-between border-b border-carbon-blue/8 bg-[var(--dashboard-surface)]/95 px-4 backdrop-blur-sm">
          <div className="min-w-0 truncate text-[11px] text-carbon-blue/55">
            <Link href="/administration" className="font-semibold text-carbon-blue/45 hover:text-upcycle-orange">
              Administration
            </Link>
            <span className="text-carbon-blue/25"> / </span>
            <Link
              href={`/administration/companies/${company.CompanyID}`}
              className="font-semibold text-carbon-blue/45 hover:text-upcycle-orange"
            >
              Companies
            </Link>
            <span className="text-carbon-blue/25"> / </span>
            <span className="font-semibold text-carbon-blue">{company.Title}</span>
          </div>
          <RoleSwitcher companies={visibleCompanies} />
        </header>

        <WorkspaceMain>
          <WorkspacePanel title="Company Master Data">
            <p className="mb-4 text-sm text-carbon-blue/55">
              Full company record for administration — not shown in daily relationship workflows.
            </p>
            <CompanyIdentityOverview identity={identity} />
            <p className="mt-4 text-[11px] text-carbon-blue/40">
              <Link href={`/companies/${company.CompanyID}`} className="font-semibold text-upcycle-orange hover:underline">
                Return to company workspace →
              </Link>
            </p>
          </WorkspacePanel>
        </WorkspaceMain>
    </WorkspaceChrome>
  );
}
