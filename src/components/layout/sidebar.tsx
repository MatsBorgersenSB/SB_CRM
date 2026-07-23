"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Clock3,
  FileText,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  Radar,
  Search,
  Settings,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { useCallback } from "react";
import { EnterpriseRoleBadge } from "@/components/auth/enterprise-role-badge";
import { useAuth } from "@/context/auth-context";
import { useUniversalSearch } from "@/context/universal-search-context";
import { canAccessRoute } from "@/lib/permissions";

type NavItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  match?: (pathname: string) => boolean;
  section?: "home" | "entities" | "intelligence" | "growth" | "admin";
};

/** Flat primary nav — every core entity is one click away. */
const navItems: NavItem[] = [
  {
    label: "Focus",
    href: "/",
    icon: LayoutDashboard,
    match: (p) => p === "/",
    section: "home",
  },
  {
    label: "Companies",
    href: "/companies",
    icon: Building2,
    match: (p) => p.startsWith("/companies"),
    section: "entities",
  },
  {
    label: "Contacts",
    href: "/contacts",
    icon: Users,
    match: (p) => p.startsWith("/contacts"),
    section: "entities",
  },
  {
    label: "Activities",
    href: "/activities",
    icon: Clock3,
    match: (p) => p.startsWith("/activities"),
    section: "entities",
  },
  {
    label: "Opportunities",
    href: "/opportunities",
    icon: TrendingUp,
    match: (p) => p.startsWith("/opportunities") || p.startsWith("/deals"),
    section: "entities",
  },
  {
    label: "Projects",
    href: "/projects",
    icon: FolderKanban,
    match: (p) => p.startsWith("/projects"),
    section: "entities",
  },
  {
    label: "SmartDocs",
    href: "/knowledge",
    icon: FileText,
    match: (p) =>
      p.startsWith("/knowledge") ||
      p.startsWith("/smartdocs") ||
      p.startsWith("/documents"),
    section: "entities",
  },
  {
    label: "Intelligence",
    href: "/intelligence",
    icon: Radar,
    match: (p) => p.startsWith("/intelligence"),
    section: "intelligence",
  },
  {
    label: "Workflows",
    href: "/workflows",
    icon: ListChecks,
    match: (p) => p.startsWith("/workflows"),
    section: "intelligence",
  },
  {
    label: "Growth Intelligence",
    href: "/growth",
    icon: Sparkles,
    match: (p) => p.startsWith("/growth"),
    section: "growth",
  },
  {
    label: "Revenue Intelligence",
    href: "/revenue",
    icon: Wallet,
    match: (p) => p.startsWith("/revenue"),
    section: "growth",
  },
  {
    label: "Administration",
    href: "/administration",
    icon: Settings,
    match: (p) => p.startsWith("/administration"),
    section: "admin",
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { openSearch } = useUniversalSearch();

  const visibleItems = navItems.filter((item) => canAccessRoute(user.role, item.href));

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;

    const links = Array.from(
      event.currentTarget.querySelectorAll<HTMLAnchorElement>("a[data-nav-link]"),
    );
    const activeIndex = links.findIndex((link) => link === document.activeElement);
    if (activeIndex === -1) return;

    event.preventDefault();
    const nextIndex =
      event.key === "ArrowDown"
        ? Math.min(links.length - 1, activeIndex + 1)
        : Math.max(0, activeIndex - 1);

    links[nextIndex]?.focus();
  }, []);

  return (
    <aside className="flex w-52 shrink-0 flex-col border-r border-carbon-blue/20 bg-carbon-blue text-light-grey">
      <div className="border-b border-white/10 px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold tracking-tight text-white">SmartCRM</p>
          <EnterpriseRoleBadge accessRole={user.role} />
        </div>
        <p className="mt-0.5 text-[10px] text-light-grey/45">Living workspace</p>
      </div>

      <div className="border-b border-white/10 px-3 py-3">
        <button
          type="button"
          onClick={openSearch}
          className="flex w-full items-center gap-2 border border-white/10 bg-white/5 px-2.5 py-2 text-left text-[11px] text-light-grey/70 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white"
        >
          <Search className="size-3.5 shrink-0" strokeWidth={2} />
          <span className="flex-1">Search or Ask…</span>
          <kbd className="font-mono text-[9px] text-light-grey/35">
            {typeof navigator !== "undefined" && navigator.platform.toLowerCase().includes("mac")
              ? "⌘K"
              : "Ctrl+K"}
          </kbd>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3" onKeyDown={handleKeyDown}>
        <ul className="space-y-0.5">
          {visibleItems.map(({ label, icon: Icon, href, match, section }, index) => {
            const active = match ? match(pathname) : pathname === href;
            const prevSection = index > 0 ? visibleItems[index - 1]?.section : null;
            const showDivider =
              (section === "entities" && prevSection === "home") ||
              (section === "growth" && prevSection === "intelligence") ||
              (section === "admin" && prevSection === "growth");

            return (
              <li key={label}>
                {showDivider ? (
                  <div className="mx-2.5 my-2 border-t border-white/10" aria-hidden />
                ) : null}
                <Link
                  href={href}
                  data-nav-link
                  className={`flex w-full items-center gap-2.5 border-l-2 px-2.5 py-2 text-left text-[13px] transition-colors ${
                    active
                      ? "border-upcycle-orange bg-white/5 font-medium text-white"
                      : "border-transparent text-light-grey/65 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon
                    className={`size-4 shrink-0 ${active ? "text-upcycle-orange" : ""}`}
                    strokeWidth={1.75}
                  />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
