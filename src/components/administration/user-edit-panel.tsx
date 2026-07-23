"use client";

import { useEffect, useState } from "react";
import { UserLifecycleWizard } from "@/components/administration/user-lifecycle-wizard";
import { UserOwnershipPanel } from "@/components/administration/user-ownership-panel";
import { useAuth } from "@/context/auth-context";
import { withAuthRoleHeaders } from "@/lib/api-auth";
import { USER_ROLE_LABELS } from "@/types/auth";
import { isUserRole } from "@/types/auth";
import {
  USER_LICENSES,
  USER_TEAMS,
  type StandardBioUserRecord,
  type UpdateUserInput,
  type UserOwnershipAnalysis,
} from "@/types/user-access";

type UserEditPanelProps = {
  user: StandardBioUserRecord;
  users: StandardBioUserRecord[];
  canManage: boolean;
  onUpdated: (user: StandardBioUserRecord) => void;
  onDeleted: (id: number) => void;
  onClose: () => void;
  onLifecycleCompleted: () => void;
};

export function UserEditPanel({
  user,
  users,
  canManage,
  onUpdated,
  onDeleted,
  onClose,
  onLifecycleCompleted,
}: UserEditPanelProps) {
  const { user: authUser } = useAuth();
  const [displayName, setDisplayName] = useState(user.displayName);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState(user.role ?? "");
  const [team, setTeam] = useState(user.team);
  const [license, setLicense] = useState(user.license);
  const [status, setStatus] = useState(user.status);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<UserOwnershipAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(true);
  const [lifecycleMode, setLifecycleMode] = useState<"transfer" | "replace" | null>(null);

  useEffect(() => {
    setDisplayName(user.displayName);
    setEmail(user.email);
    setRole(user.role ?? "");
    setTeam(user.team);
    setLicense(user.license);
    setStatus(user.status);
  }, [user]);

  useEffect(() => {
    setAnalysisLoading(true);
    void fetch(`/api/administration/users/${user.id}/ownership`, {
      headers: withAuthRoleHeaders(authUser.role),
    })
      .then(async (response) => {
        if (!response.ok) return;
        const body = (await response.json()) as { analysis: UserOwnershipAnalysis };
        setAnalysis(body.analysis);
      })
      .finally(() => setAnalysisLoading(false));
  }, [user.id, authUser.role]);

  async function patchUser(patch: UpdateUserInput & { action?: string }) {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/administration/users/${user.id}`, {
        method: "PATCH",
        headers: withAuthRoleHeaders(authUser.role, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify(patch),
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Update failed");
      }
      const body = (await response.json()) as { user: StandardBioUserRecord };
      onUpdated(body.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSave() {
    await patchUser({
      displayName,
      email,
      role: role && isUserRole(role) ? role : null,
      team,
      license,
      status,
    });
  }

  async function handleDisable() {
    await patchUser({ action: "disable" });
    setStatus("disabled");
  }

  async function handleArchive() {
    await patchUser({ action: "archive" });
    setStatus("archived");
  }

  async function handleDelete() {
    if (!window.confirm(`Delete ${user.displayName}? This cannot be undone.`)) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/administration/users/${user.id}`, {
        method: "DELETE",
        headers: withAuthRoleHeaders(authUser.role),
      });
      if (response.status === 409) {
        const body = (await response.json()) as {
          error?: string;
          analysis?: UserOwnershipAnalysis;
        };
        if (body.analysis) setAnalysis(body.analysis);
        throw new Error(
          body.error ??
            "Cannot delete — ownership must be transferred first.",
        );
      }
      if (!response.ok) {
        throw new Error("Delete failed");
      }
      onDeleted(user.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setSubmitting(false);
    }
  }

  function handleLifecycleCompleted() {
    setLifecycleMode(null);
    onLifecycleCompleted();
    void fetch(`/api/administration/users/${user.id}/ownership`)
      .then(async (response) => {
        if (!response.ok) return;
        const body = (await response.json()) as { analysis: UserOwnershipAnalysis };
        setAnalysis(body.analysis);
      })
      .catch(() => undefined);
  }

  return (
    <>
      <div className="border border-carbon-blue/10 bg-carbon-blue/[0.02] p-4">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-carbon-blue/40">
              User lifecycle
            </p>
            <p className="text-sm font-semibold text-carbon-blue">{user.userId}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45 hover:text-carbon-blue"
          >
            Close
          </button>
        </div>

        <UserOwnershipPanel analysis={analysis} loading={analysisLoading} />

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/40">
              Display name
            </span>
            <input
              type="text"
              value={displayName}
              disabled={!canManage}
              onChange={(event) => setDisplayName(event.target.value)}
              className="mt-1 w-full border border-carbon-blue/15 px-3 py-2 text-[12px] text-carbon-blue disabled:bg-carbon-blue/[0.02]"
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/40">
              Email
            </span>
            <input
              type="email"
              value={email}
              disabled={!canManage}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full border border-carbon-blue/15 px-3 py-2 text-[12px] text-carbon-blue disabled:bg-carbon-blue/[0.02]"
            />
          </label>

          <label className="block">
            <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/40">
              Role
            </span>
            <select
              value={role}
              disabled={!canManage}
              onChange={(event) => setRole(event.target.value)}
              className="mt-1 w-full border border-carbon-blue/15 px-3 py-2 text-[12px] text-carbon-blue disabled:bg-carbon-blue/[0.02]"
            >
              <option value="">No role</option>
              {Object.entries(USER_ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/40">
              Status
            </span>
            <select
              value={status}
              disabled={!canManage}
              onChange={(event) =>
                setStatus(event.target.value as StandardBioUserRecord["status"])
              }
              className="mt-1 w-full border border-carbon-blue/15 px-3 py-2 text-[12px] text-carbon-blue disabled:bg-carbon-blue/[0.02]"
            >
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
              <option value="inactive">Inactive</option>
              <option value="archived">Archived</option>
            </select>
          </label>

          <label className="block">
            <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/40">
              Team
            </span>
            <select
              value={team}
              disabled={!canManage}
              onChange={(event) => setTeam(event.target.value as (typeof USER_TEAMS)[number])}
              className="mt-1 w-full border border-carbon-blue/15 px-3 py-2 text-[12px] text-carbon-blue disabled:bg-carbon-blue/[0.02]"
            >
              {USER_TEAMS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/40">
              License
            </span>
            <select
              value={license}
              disabled={!canManage}
              onChange={(event) => setLicense(event.target.value as (typeof USER_LICENSES)[number])}
              className="mt-1 w-full border border-carbon-blue/15 px-3 py-2 text-[12px] text-carbon-blue disabled:bg-carbon-blue/[0.02]"
            >
              {USER_LICENSES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error ? <p className="mt-3 text-[11px] text-thermal-red">{error}</p> : null}

        {canManage ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleSave()}
              className="border border-upcycle-orange bg-upcycle-orange px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white disabled:opacity-50"
            >
              Save changes
            </button>
            {analysis?.hasOwnership ? (
              <>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setLifecycleMode("transfer")}
                  className="border border-carbon-blue/15 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/70"
                >
                  Transfer ownership
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setLifecycleMode("replace")}
                  className="border border-carbon-blue/15 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/70"
                >
                  Replace user
                </button>
              </>
            ) : null}
            {user.status === "active" ? (
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleDisable()}
                className="border border-carbon-blue/15 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/60"
              >
                Disable user
              </button>
            ) : null}
            {user.status !== "archived" ? (
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleArchive()}
                className="border border-carbon-blue/15 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/60"
              >
                Archive user
              </button>
            ) : null}
            <button
              type="button"
              disabled={submitting || Boolean(analysis?.hasOwnership)}
              onClick={() => void handleDelete()}
              className="border border-thermal-red/30 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-thermal-red disabled:opacity-40"
              title={
                analysis?.hasOwnership
                  ? "Transfer ownership before deleting"
                  : undefined
              }
            >
              Delete user
            </button>
          </div>
        ) : (
          <p className="mt-3 text-[11px] text-carbon-blue/45">Read-only — superuser required to edit.</p>
        )}
      </div>

      {lifecycleMode ? (
        <UserLifecycleWizard
          open
          mode={lifecycleMode}
          user={user}
          users={users}
          onClose={() => setLifecycleMode(null)}
          onCompleted={handleLifecycleCompleted}
        />
      ) : null}
    </>
  );
}
