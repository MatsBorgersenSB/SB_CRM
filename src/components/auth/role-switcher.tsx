"use client";

import { EnterpriseRoleBadge } from "@/components/auth/enterprise-role-badge";
import { useAuth } from "@/context/auth-context";
import type { Company } from "@/lib/companies-data";
import {
  USER_ROLE_DESCRIPTIONS,
  USER_ROLE_LABELS,
  USER_ROLES,
  type UserRole,
} from "@/types/auth";

export function RoleSwitcher({ companies }: { companies?: Company[] }) {
  const { user, setRole, setCompanyId } = useAuth();

  return (
    <div className="flex items-center gap-2">
      <EnterpriseRoleBadge
        accessRole={user.role}
        compact
        tone="light"
      />
      <label className="flex items-center gap-1.5">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
          Access Tier
        </span>
        <select
          value={user.role}
          onChange={(event) => setRole(event.target.value as UserRole)}
          className="border border-carbon-blue/15 bg-white px-2 py-0.5 text-[10px] font-semibold text-carbon-blue outline-none focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40"
          title={USER_ROLE_DESCRIPTIONS[user.role]}
        >
          {USER_ROLES.map((role) => (
            <option key={role} value={role}>
              {USER_ROLE_LABELS[role]}
            </option>
          ))}
        </select>
      </label>
      {user.role === "client_lead" && companies?.length ? (
        <label className="flex items-center gap-1.5">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            Company Scope
          </span>
          <select
            value={user.companyId ?? ""}
            onChange={(event) => setCompanyId(event.target.value || undefined)}
            className="border border-carbon-blue/15 bg-white px-2 py-0.5 text-[10px] font-semibold text-carbon-blue outline-none focus:border-upcycle-orange focus:ring-1 focus:ring-upcycle-orange/40"
          >
            {companies.map((company) => (
              <option key={company.CompanyID} value={company.CompanyID}>
                {company.Title}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  );
}
