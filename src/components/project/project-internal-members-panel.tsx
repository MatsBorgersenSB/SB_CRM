"use client";

import { useMemo, useState } from "react";
import type { ProjectInternalMember } from "@/types/project";
import { STANDARD_BIO_USERS } from "@/types/bio-user";
import { SmartCRMIcon } from "@/components/ui/smartcrm-icon";

export function ProjectInternalMembersPanel({
  members,
  readOnly = false,
  onAdd,
  onRemove,
}: {
  members: ProjectInternalMember[];
  readOnly?: boolean;
  onAdd?: (member: ProjectInternalMember) => Promise<void>;
  onRemove?: (index: number) => Promise<void>;
}) {
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [role, setRole] = useState("");
  const [saving, setSaving] = useState(false);
  const [removingIndex, setRemovingIndex] = useState<number | null>(null);

  const availableUsers = useMemo(() => {
    const assigned = new Set(members.map((member) => member.userId));
    return STANDARD_BIO_USERS.filter((user) => !assigned.has(user.Id)).sort((a, b) =>
      a.Title.localeCompare(b.Title),
    );
  }, [members]);

  const handleAdd = async () => {
    const user = STANDARD_BIO_USERS.find((entry) => entry.Id === Number(selectedUserId));
    if (!user || !role.trim() || !onAdd) return;

    setSaving(true);
    try {
      await onAdd({
        userId: user.Id,
        name: user.Title,
        role: role.trim(),
      });
      setSelectedUserId("");
      setRole("");
      setAssignOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (index: number) => {
    if (!onRemove) return;
    setRemovingIndex(index);
    try {
      await onRemove(index);
    } finally {
      setRemovingIndex(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {members.length === 0 ? (
        <p className="text-sm text-carbon-blue/45">
          No internal team members yet. Add Standard Bio staff who deliver this project.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-carbon-blue/10 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                <th className="px-2 py-2 font-semibold">Team member</th>
                <th className="px-2 py-2 font-semibold">Role on project</th>
                {!readOnly && onRemove ? <th className="px-2 py-2 font-semibold"> </th> : null}
              </tr>
            </thead>
            <tbody>
              {members.map((member, index) => (
                <tr key={`${member.userId}-${member.role}`} className="border-b border-carbon-blue/5">
                  <td className="px-2 py-2.5 font-medium text-carbon-blue">{member.name}</td>
                  <td className="px-2 py-2.5 text-carbon-blue/70">{member.role}</td>
                  {!readOnly && onRemove ? (
                    <td className="px-2 py-2.5">
                      <button
                        type="button"
                        disabled={removingIndex === index}
                        onClick={() => void handleRemove(index)}
                        className="text-[11px] font-semibold text-carbon-blue/45 hover:text-red-600 disabled:opacity-50"
                      >
                        {removingIndex === index ? "…" : "Remove"}
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!readOnly && onAdd ? (
        <div>
          {assignOpen ? (
            <div className="border border-carbon-blue/10 bg-carbon-blue/[0.02] p-4">
              <p className="mb-2 text-[11px] text-carbon-blue/55">
                Select a Standard Bio team member
              </p>
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">
                  Team member
                </span>
                <select
                  value={selectedUserId}
                  onChange={(event) => setSelectedUserId(event.target.value)}
                  className="mt-1 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px] text-carbon-blue"
                >
                  <option value="">Select team member…</option>
                  {availableUsers.map((user) => (
                    <option key={user.Id} value={user.Id}>
                      {user.Title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mt-3 block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">
                  Role on project
                </span>
                <input
                  type="text"
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                  placeholder="e.g. Delivery Lead"
                  className="mt-1 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px] text-carbon-blue"
                />
              </label>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={saving || !selectedUserId || !role.trim() || availableUsers.length === 0}
                  onClick={() => void handleAdd()}
                  className="border border-upcycle-orange bg-upcycle-orange px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {saving ? "Adding…" : "Add member"}
                </button>
                <button
                  type="button"
                  onClick={() => setAssignOpen(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-carbon-blue/55 hover:text-carbon-blue"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAssignOpen(true)}
              disabled={availableUsers.length === 0}
              className="inline-flex items-center gap-1.5 border border-carbon-blue/12 px-3 py-1.5 text-[11px] font-semibold text-carbon-blue/65 transition-colors hover:border-upcycle-orange/30 hover:text-upcycle-orange disabled:opacity-50"
            >
              <SmartCRMIcon name="add" size="xs" />
              Add team member
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
