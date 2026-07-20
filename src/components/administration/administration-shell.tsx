"use client";

import Link from "next/link";
import { AssistedEverythingPanel } from "@/components/administration/assisted-everything-panel";
import { WorkspaceChrome } from "@/components/layout/workspace-chrome";
import { WorkspaceMain } from "@/components/ui/workspace-main";
import { WorkspacePanel, SmartCRMIcon } from "@/components/ui/smartcrm-icon";
import { WorkspaceStack } from "@/components/ui/workspace-main";
import { useAuth } from "@/context/auth-context";
import { canAccessAssistedConfiguration, canAccessUsersAccess, canAccessWorkspaceArchitect, filterCompaniesForUser } from "@/lib/permissions";
import { ASSISTED_CONFIGURATION, ASSISTED_EVERYTHING, SMARTCRM_PLATFORM_CONSTITUTION, USERS_ACCESS_MANAGEMENT, WORKSPACE_ARCHITECT } from "@/lib/smart-assist-config";
import type { Company } from "@/types/company";

export function AdministrationShell({ companies }: { companies: Company[] }) {
  const { user } = useAuth();
  const visibleCompanies = filterCompaniesForUser(companies, user);
  const showAssistedConfig = canAccessAssistedConfiguration(user.role);
  const showWorkspaceArchitect = canAccessWorkspaceArchitect(user.role);
  const showUsersAccess = canAccessUsersAccess(user.role);

  return (
    <WorkspaceChrome>
        <header className="sticky top-0 z-10 flex h-11 shrink-0 items-center border-b border-carbon-blue/8 bg-[var(--dashboard-surface)]/95 px-4 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-[11px] text-carbon-blue/55">
            <SmartCRMIcon name="edit" size="xs" />
            <span className="font-semibold text-carbon-blue">Administration</span>
          </div>
        </header>

        <WorkspaceMain>
          <WorkspaceStack>
            <AssistedEverythingPanel />

            {showWorkspaceArchitect ? (
              <WorkspacePanel title={WORKSPACE_ARCHITECT.title}>
                <p className="mb-2 text-sm font-medium text-carbon-blue">
                  {WORKSPACE_ARCHITECT.vision}
                </p>
                <p className="mb-3 text-sm text-carbon-blue/55">
                  {WORKSPACE_ARCHITECT.description} {WORKSPACE_ARCHITECT.principle}
                </p>
                <Link
                  href="/administration/workspace-architect"
                  className="inline-flex items-center gap-2 border border-upcycle-orange bg-upcycle-orange px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-white transition-opacity hover:opacity-90"
                >
                  Start workspace conversation
                </Link>
              </WorkspacePanel>
            ) : null}

            {showAssistedConfig ? (
              <WorkspacePanel title="Workspace Architecture">
                <p className="mb-2 text-sm font-medium text-carbon-blue">
                  {SMARTCRM_PLATFORM_CONSTITUTION.platform}
                </p>
                <p className="mb-3 text-sm text-carbon-blue/55">
                  {ASSISTED_EVERYTHING.smartAssistRole}{" "}
                  {ASSISTED_CONFIGURATION.customerManages}{" "}
                  {ASSISTED_CONFIGURATION.smartAssistManages}
                </p>
                <Link
                  href="/administration/assisted-configuration"
                  className="inline-flex items-center gap-2 border border-upcycle-orange bg-upcycle-orange px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-white transition-opacity hover:opacity-90"
                >
                  Review workspace architecture
                </Link>
              </WorkspacePanel>
            ) : null}

            {showUsersAccess ? (
              <WorkspacePanel title="Users & Access">
                <p className="mb-2 text-sm font-medium text-carbon-blue">
                  {USERS_ACCESS_MANAGEMENT.title}
                </p>
                <p className="mb-3 text-sm text-carbon-blue/55">
                  {USERS_ACCESS_MANAGEMENT.description}{" "}
                  {ASSISTED_EVERYTHING.division.user}
                </p>
                <Link
                  href="/administration/users-access"
                  className="inline-flex items-center gap-2 border border-upcycle-orange bg-upcycle-orange px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-white transition-opacity hover:opacity-90"
                >
                  Manage users & access
                </Link>
              </WorkspacePanel>
            ) : null}

            <WorkspacePanel title="Company Master Data">
              <p className="mb-4 text-sm text-carbon-blue/55">
                Manage full company records outside daily workflows.
              </p>
              <ul className="divide-y divide-carbon-blue/8 border border-carbon-blue/10">
                {visibleCompanies.map((company) => (
                  <li key={company.CompanyID}>
                    <Link
                      href={`/administration/companies/${company.CompanyID}`}
                      className="flex items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-carbon-blue/[0.02]"
                    >
                      <span className="font-medium text-carbon-blue">{company.Title}</span>
                      <span className="text-[11px] text-carbon-blue/40">{company.Status}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </WorkspacePanel>
          </WorkspaceStack>
        </WorkspaceMain>
    </WorkspaceChrome>
  );
}
