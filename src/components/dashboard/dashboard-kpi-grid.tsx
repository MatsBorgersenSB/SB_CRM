import Link from "next/link";
import type { ReactNode } from "react";
import type { DashboardKpis } from "@/lib/relationship-intelligence";
import {
  AlertCircle,
  Building2,
  CircleDollarSign,
  Clock3,
  Users,
  Workflow,
} from "lucide-react";

type KpiLink = {
  label: string;
  value: string | number;
  href: string;
  icon: ReactNode;
  accent?: "orange" | "warning";
};

export function DashboardKpiGrid({ kpis }: { kpis: DashboardKpis }) {
  const cards: KpiLink[] = [
    {
      label: "Pipeline Value",
      value: kpis.pipelineValue,
      href: "/deals",
      icon: <CircleDollarSign className="size-4" strokeWidth={1.75} />,
      accent: "orange",
    },
    {
      label: "Active Deals",
      value: kpis.activeDeals,
      href: "/deals",
      icon: <Workflow className="size-4" strokeWidth={1.75} />,
    },
    {
      label: "Open Follow-Ups",
      value: kpis.openFollowUps,
      href: "/activities",
      icon: <Clock3 className="size-4" strokeWidth={1.75} />,
      accent: kpis.openFollowUps > 0 ? "orange" : undefined,
    },
    {
      label: "Overdue Actions",
      value: kpis.overdueFollowUps,
      href: "/activities",
      icon: <AlertCircle className="size-4" strokeWidth={1.75} />,
      accent: kpis.overdueFollowUps > 0 ? "warning" : undefined,
    },
    {
      label: "Companies",
      value: kpis.totalCompanies,
      href: "/companies",
      icon: <Building2 className="size-4" strokeWidth={1.75} />,
    },
    {
      label: "Contacts",
      value: kpis.totalContacts,
      href: "/contacts",
      icon: <Users className="size-4" strokeWidth={1.75} />,
    },
  ];

  return (
    <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((card) => (
        <Link
          key={card.label}
          href={card.href}
          className={`dashboard-card group flex flex-col gap-2 p-3.5 transition-all duration-150 hover:-translate-y-px hover:shadow-[0_8px_24px_-12px_rgba(31,28,36,0.15)] ${
            card.accent === "warning"
              ? "hover:border-red-500/25"
              : card.accent === "orange"
                ? "hover:border-upcycle-orange/30"
                : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
              {card.label}
            </p>
            <span className="text-carbon-blue/35 transition-colors group-hover:text-upcycle-orange">
              {card.icon}
            </span>
          </div>
          <p className="text-xl font-semibold tabular-nums tracking-tight text-carbon-blue">
            {card.value}
          </p>
        </Link>
      ))}
    </section>
  );
}
