"use client";

import { RoleSwitcher } from "@/components/auth/role-switcher";
import { WorkspaceChrome } from "@/components/layout/workspace-chrome";
import { WorkspaceHeader } from "@/components/ui/workspace-header";
import { WorkspaceMain } from "@/components/ui/workspace-main";
import type { Company } from "@/types/company";

export function RevenueIntelligenceChrome({
  companies,
  children,
}: {
  companies: Company[];
  children: React.ReactNode;
}) {
  return (
    <WorkspaceChrome>
      <WorkspaceHeader
        scope="Revenue Intelligence"
        title="Understand, forecast and prioritize revenue"
        context="Every opportunity connected to a realistic commercial path — machinery, services, recurring"
        actions={<RoleSwitcher companies={companies} />}
      />
      <WorkspaceMain>{children}</WorkspaceMain>
    </WorkspaceChrome>
  );
}
