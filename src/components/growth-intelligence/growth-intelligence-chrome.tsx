"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RoleSwitcher } from "@/components/auth/role-switcher";
import { WorkspaceChrome } from "@/components/layout/workspace-chrome";
import { WorkspaceHeader } from "@/components/ui/workspace-header";
import { WorkspaceMain } from "@/components/ui/workspace-main";
import { GROWTH_INTELLIGENCE_SECTIONS } from "@/types/growth-intelligence";
import type { Company } from "@/types/company";

export function GrowthIntelligenceChrome({
  companies,
  children,
}: {
  companies: Company[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const activeSection = GROWTH_INTELLIGENCE_SECTIONS.find((section) =>
    section.id === "dashboard" ? pathname === "/growth" : pathname.startsWith(section.href),
  );

  return (
    <WorkspaceChrome>
      <WorkspaceHeader
        scope="Growth Intelligence"
        title="Strategic operating loop"
        context="This week → This quarter → Watch. Observed CRM first. Strategy notes stay labelled."
        actions={<RoleSwitcher companies={companies} />}
      />

      <nav
        aria-label="Growth Intelligence sections"
        className="shrink-0 border-b border-carbon-blue/8 bg-[var(--dashboard-surface)]"
      >
        <div className="flex overflow-x-auto px-4">
          {GROWTH_INTELLIGENCE_SECTIONS.map((section) => {
            const active =
              section.id === "dashboard"
                ? pathname === "/growth"
                : pathname.startsWith(section.href);
            return (
              <Link
                key={section.id}
                href={section.href}
                className={`relative shrink-0 px-3 py-2.5 text-[11px] font-semibold tracking-wide transition-colors ${
                  active
                    ? "text-upcycle-orange"
                    : "text-carbon-blue/45 hover:text-carbon-blue/70"
                }`}
              >
                {section.label}
                {active ? (
                  <span className="absolute inset-x-1 bottom-0 h-0.5 bg-upcycle-orange" />
                ) : null}
              </Link>
            );
          })}
        </div>
        {activeSection ? (
          <p className="border-t border-carbon-blue/6 px-4 py-2 text-[11px] text-carbon-blue/50">
            {activeSection.description}
          </p>
        ) : null}
      </nav>

      <WorkspaceMain>{children}</WorkspaceMain>
    </WorkspaceChrome>
  );
}
