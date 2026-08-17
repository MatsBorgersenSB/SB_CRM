"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { UserCreateWizard } from "@/components/administration/user-create-wizard";
import { AssistedEverythingPanel } from "@/components/administration/assisted-everything-panel";
import { UserEditPanel } from "@/components/administration/user-edit-panel";
import { UsersAccessAuditPanel } from "@/components/administration/users-access-audit-panel";
import { UsersTable } from "@/components/administration/users-table";
import { IntelligenceLead } from "@/components/ui/intelligence-lead";
import { WorkspaceMain } from "@/components/ui/workspace-main";
import { WorkspacePanel, SmartCRMIcon } from "@/components/ui/smartcrm-icon";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { WorkspaceStack } from "@/components/ui/workspace-main";
import { useAuth } from "@/context/auth-context";
import { withAuthRoleHeaders } from "@/lib/api-auth";
import { canManageUsers } from "@/lib/permissions";
import { ASSISTED_EVERYTHING, USER_LIFECYCLE_MANAGEMENT, USERS_ACCESS_MANAGEMENT } from "@/lib/smart-assist-config";
import type { StandardBioUserRecord, UsersAccessAudit } from "@/types/user-access";

export function UsersAccessShell({
  initialUsers,
  initialAudit,
}: {
  initialUsers: StandardBioUserRecord[];
  initialAudit: UsersAccessAudit;
}) {
  const { user } = useAuth();
  const canManage = canManageUsers(user.role);
  const [users, setUsers] = useState(initialUsers);
  const [audit, setAudit] = useState(initialAudit);
  const [selectedUser, setSelectedUser] = useState<StandardBioUserRecord | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  const refreshAudit = useCallback(async () => {
    const response = await fetch("/api/administration/users-access-audit", {
      headers: withAuthRoleHeaders(user.role),
    });
    if (response.ok) {
      const nextAudit = (await response.json()) as UsersAccessAudit;
      setAudit(nextAudit);
    }
  }, [user.role]);

  const handleCreated = (user: StandardBioUserRecord) => {
    setUsers((current) => [...current, user].sort((a, b) => a.displayName.localeCompare(b.displayName)));
    void refreshAudit();
  };

  const handleUpdated = (user: StandardBioUserRecord) => {
    setUsers((current) =>
      current.map((record) => (record.id === user.id ? user : record)).sort((a, b) => a.displayName.localeCompare(b.displayName)),
    );
    setSelectedUser(user);
    void refreshAudit();
  };

  const handleLifecycleCompleted = () => {
    void refreshAudit();
    void fetch("/api/administration/users", {
      headers: withAuthRoleHeaders(user.role),
    })
      .then(async (response) => {
        if (!response.ok) return;
        const body = (await response.json()) as { users: StandardBioUserRecord[] };
        setUsers(body.users);
        if (selectedUser) {
          const refreshed = body.users.find((record) => record.id === selectedUser.id);
          if (refreshed) setSelectedUser(refreshed);
        }
      })
      .catch(() => undefined);
  };

  const handleDeleted = (id: number) => {
    setUsers((current) => current.filter((user) => user.id !== id));
    setSelectedUser(null);
    void refreshAudit();
  };

  const activeCount = users.filter((user) => user.status === "active").length;
  const noRoleCount = users.filter((user) => user.status === "active" && !user.role).length;
  const criticalGaps = audit.gaps.filter((gap) => gap.severity === "critical").length;

  return (
    <>
      <header className="sticky top-0 z-10 flex h-11 shrink-0 items-center justify-between border-b border-carbon-blue/8 bg-[var(--dashboard-surface)]/95 px-4 backdrop-blur-sm">
        <div className="flex min-w-0 items-center gap-2 text-[11px] text-carbon-blue/55">
          <Link href="/administration" className="font-semibold hover:text-upcycle-orange">
            Administration
          </Link>
          <span className="text-carbon-blue/25">/</span>
          <SmartCRMIcon name="edit" size="xs" />
          <span className="truncate font-semibold text-carbon-blue">Users & Access</span>
        </div>
        <ThemeToggle />
      </header>

      <WorkspaceMain>
        <WorkspaceStack>
          <IntelligenceLead
            eyebrow={`SmartAssist · ${ASSISTED_EVERYTHING.title}`}
            title={USER_LIFECYCLE_MANAGEMENT.title}
            summary={`${audit.summary} ${ASSISTED_EVERYTHING.mantra}`}
            vitals={[
              { label: "Active users", value: String(activeCount) },
              { label: "Without roles", value: String(noRoleCount), highlight: noRoleCount > 0 },
              { label: "Access gaps", value: String(audit.gaps.length), highlight: audit.gaps.length > 0 },
              { label: "Critical", value: String(criticalGaps), highlight: criticalGaps > 0 },
            ]}
            action={
              audit.primaryActionHref ? (
                <Link
                  href={audit.primaryActionHref}
                  className="inline-flex border border-upcycle-orange bg-upcycle-orange px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white"
                >
                  {audit.primaryAction}
                </Link>
              ) : (
                <p className="text-[12px] font-medium text-upcycle-orange">{audit.primaryAction}</p>
              )
            }
          />

          <AssistedEverythingPanel compact />

          <WorkspacePanel title="Standard Bio Users">
            <p className="mb-4 text-sm text-carbon-blue/55">{USERS_ACCESS_MANAGEMENT.description}</p>

            {canManage ? (
              <div className="mb-4">
                <button
                  type="button"
                  onClick={() => setWizardOpen(true)}
                  className="inline-flex items-center gap-2 border border-upcycle-orange bg-upcycle-orange px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-white transition-opacity hover:opacity-90"
                >
                  + Add User
                </button>
              </div>
            ) : null}

            <UsersTable
              users={users}
              selectedId={selectedUser?.id ?? null}
              onSelect={setSelectedUser}
            />

            {selectedUser ? (
              <div className="mt-4">
                <UserEditPanel
                  user={selectedUser}
                  users={users}
                  canManage={canManage}
                  onUpdated={handleUpdated}
                  onDeleted={handleDeleted}
                  onClose={() => setSelectedUser(null)}
                  onLifecycleCompleted={handleLifecycleCompleted}
                />
              </div>
            ) : null}
          </WorkspacePanel>

          <WorkspacePanel title="Governance Domains" collapsible defaultCollapsed>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {USERS_ACCESS_MANAGEMENT.domains.map((domain) => (
                <div
                  key={domain}
                  className="border border-carbon-blue/10 bg-carbon-blue/[0.02] p-4"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-carbon-blue/45">
                    {domain}
                  </p>
                  <p className="mt-2 text-[12px] leading-relaxed text-carbon-blue/70">
                    Managed from this workspace — SmartAssist recommends; administrators decide.
                  </p>
                </div>
              ))}
            </div>
          </WorkspacePanel>

          <WorkspacePanel title="User Lifecycle" collapsible defaultCollapsed>
            <p className="mb-3 text-sm text-carbon-blue/55">{ASSISTED_EVERYTHING.mantra}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/40">
                  Lifecycle actions
                </p>
                <ul className="mt-2 space-y-1 text-[12px] text-carbon-blue/70">
                  {USER_LIFECYCLE_MANAGEMENT.lifecycleActions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/40">
                  SmartAssist answers
                </p>
                <ul className="mt-2 space-y-1 text-[12px] text-carbon-blue/70">
                  {USER_LIFECYCLE_MANAGEMENT.successCriteria.map((question) => (
                    <li key={question}>{question}</li>
                  ))}
                </ul>
              </div>
            </div>
          </WorkspacePanel>

          <UsersAccessAuditPanel audit={audit} />
        </WorkspaceStack>
      </WorkspaceMain>

      <UserCreateWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={handleCreated}
      />
    </>
  );
}
