"use client";

import { USER_ROLE_LABELS } from "@/types/auth";
import type { StandardBioUserRecord } from "@/types/user-access";

const STATUS_STYLES: Record<StandardBioUserRecord["status"], string> = {
  active: "text-upcycle-orange",
  disabled: "text-thermal-red",
  inactive: "text-carbon-blue/40",
  archived: "text-carbon-blue/35",
};

export function UsersTable({
  users,
  selectedId,
  onSelect,
}: {
  users: StandardBioUserRecord[];
  selectedId: number | null;
  onSelect: (user: StandardBioUserRecord) => void;
}) {
  return (
    <div className="overflow-x-auto border border-carbon-blue/10">
      <table className="w-full min-w-[720px] text-left text-[12px]">
        <thead className="border-b border-carbon-blue/8 bg-carbon-blue/[0.02] text-[9px] font-bold uppercase tracking-[0.1em] text-carbon-blue/40">
          <tr>
            <th className="px-4 py-2.5">User</th>
            <th className="px-4 py-2.5">Role</th>
            <th className="px-4 py-2.5">Function</th>
            <th className="px-4 py-2.5">Team</th>
            <th className="px-4 py-2.5">License</th>
            <th className="px-4 py-2.5">Scope</th>
            <th className="px-4 py-2.5">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-carbon-blue/8">
          {users.map((user) => (
            <tr
              key={user.id}
              onClick={() => onSelect(user)}
              className={`cursor-pointer transition-colors hover:bg-carbon-blue/[0.02] ${
                selectedId === user.id ? "bg-upcycle-orange/[0.04]" : ""
              }`}
            >
              <td className="px-4 py-3">
                <p className="font-medium text-carbon-blue">{user.displayName}</p>
                <p className="text-[10px] text-carbon-blue/45">
                  {user.userId} · {user.email}
                </p>
              </td>
              <td className="px-4 py-3 text-carbon-blue/70">
                {user.role ? USER_ROLE_LABELS[user.role] : "—"}
              </td>
              <td className="px-4 py-3 text-carbon-blue/70">{user.businessFunction ?? "—"}</td>
              <td className="px-4 py-3 text-carbon-blue/70">{user.team}</td>
              <td className="px-4 py-3 text-carbon-blue/70">{user.license}</td>
              <td className="px-4 py-3 capitalize text-carbon-blue/70">{user.ownershipScope}</td>
              <td className={`px-4 py-3 font-medium capitalize ${STATUS_STYLES[user.status]}`}>
                {user.status}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
