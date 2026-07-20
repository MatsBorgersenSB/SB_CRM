import Link from "next/link";
import {
  Building2,
  Clock3,
  Plus,
  UserPlus,
  Workflow,
} from "lucide-react";

const actions = [
  {
    label: "Record Interaction",
    href: "/activities",
    icon: Clock3,
    primary: true,
  },
  {
    label: "New Company",
    href: "/companies",
    icon: Building2,
    primary: false,
  },
  {
    label: "New Contact",
    href: "/contacts",
    icon: UserPlus,
    primary: false,
  },
  {
    label: "New Deal",
    href: "/deals",
    icon: Workflow,
    primary: false,
  },
  {
    label: "New Activity",
    href: "/activities",
    icon: Plus,
    primary: false,
  },
] as const;

export function DashboardQuickActionsBar() {
  return (
    <nav
      aria-label="Quick actions"
      className="dashboard-card flex flex-wrap items-center gap-2 px-3 py-2.5"
    >
      <span className="mr-1 hidden text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/35 sm:inline">
        Quick actions
      </span>
      {actions.map((action) => (
        <Link
          key={action.label}
          href={action.href}
          className={`inline-flex items-center gap-1.5 border px-3 py-1.5 text-[11px] font-semibold transition-all duration-150 ${
            action.primary
              ? "border-upcycle-orange/30 bg-upcycle-orange text-white hover:bg-upcycle-orange/90"
              : "border-carbon-blue/10 bg-white text-carbon-blue/70 hover:border-carbon-blue/20 hover:text-carbon-blue"
          }`}
        >
          <action.icon className="size-3.5" strokeWidth={1.75} />
          <Plus className="size-2.5 opacity-60" />
          {action.label}
        </Link>
      ))}
    </nav>
  );
}
