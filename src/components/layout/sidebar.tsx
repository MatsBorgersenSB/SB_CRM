"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Search,
  Settings,
  TrendingUp,
  Users,
} from "lucide-react";
import { useCallback } from "react";
import { EnterpriseRoleBadge } from "@/components/auth/enterprise-role-badge";
import { M365MailSyncHeaderButton } from "@/components/m365/m365-mail-sync-header-button";
import { useAuth } from "@/context/auth-context";
import { useUniversalSearch } from "@/context/universal-search-context";
import { cn } from "@/lib/cn";
import { canAccessRoute } from "@/lib/permissions";

type NavItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  match?: (pathname: string) => boolean;
  section?: "home" | "work" | "admin";
};

/** Primary destinations — intelligence engines feed Today, they are not peer products. */
const navItems: NavItem[] = [
  {
    label: "Today",
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
    section: "work",
  },
  {
    label: "People",
    href: "/contacts",
    icon: Users,
    match: (p) => p.startsWith("/contacts"),
    section: "work",
  },
  {
    label: "Opportunities",
    href: "/opportunities",
    icon: TrendingUp,
    match: (p) => p.startsWith("/opportunities") || p.startsWith("/deals"),
    section: "work",
  },
  {
    label: "Projects",
    href: "/projects",
    icon: FolderKanban,
    match: (p) => p.startsWith("/projects"),
    section: "work",
  },
  {
    label: "Knowledge",
    href: "/knowledge",
    icon: FileText,
    match: (p) =>
      p.startsWith("/knowledge") ||
      p.startsWith("/smartdocs") ||
      p.startsWith("/documents"),
    section: "work",
  },
  {
    label: "Admin",
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
    <aside className="flex w-52 shrink-0 flex-col border-r border-border/60 bg-card text-foreground">
      <div className="border-b border-border/60 px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold tracking-tight text-foreground">SmartCRM</p>
          <EnterpriseRoleBadge accessRole={user.role} tone="light" />
        </div>
      </div>

      <div className="border-b border-border/60 px-3 py-3">
        <button
          type="button"
          onClick={openSearch}
          className={cn(
            "flex w-full items-center gap-2 rounded-md border border-border/60 bg-muted/50 px-2.5 py-2",
            "text-left text-xs text-muted-foreground transition-colors",
            "hover:border-border hover:bg-accent/80 hover:text-foreground",
          )}
        >
          <Search className="size-3.5 shrink-0" strokeWidth={2} />
          <span className="flex-1">Search or Ask…</span>
          <kbd className="font-mono text-[9px] text-muted-foreground/70">
            {typeof navigator !== "undefined" && navigator.platform.toLowerCase().includes("mac")
              ? "⌘K"
              : "Ctrl+K"}
          </kbd>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3" onKeyDown={handleKeyDown}>
        <ul className="flex flex-col gap-0.5">
          {visibleItems.map(({ label, icon: Icon, href, match, section }, index) => {
            const active = match ? match(pathname) : pathname === href;
            const prevSection = index > 0 ? visibleItems[index - 1]?.section : null;
            const showDivider = section === "admin" && prevSection === "work";

            return (
              <li key={label}>
                {showDivider ? (
                  <div className="mx-2.5 my-2 border-t border-border/60" aria-hidden />
                ) : null}
                <Link
                  href={href}
                  data-nav-link
                  className={cn(
                    "flex w-full items-center gap-2.5 border-l-2 px-2.5 py-2 text-left text-xs tracking-tight transition-colors",
                    active
                      ? "border-primary bg-accent/80 font-medium text-foreground"
                      : "border-transparent text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                  )}
                >
                  <Icon
                    className={cn("size-4 shrink-0", active ? "text-primary" : "")}
                    strokeWidth={1.75}
                  />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-border/60 px-3 py-3">
        <M365MailSyncHeaderButton compact />
      </div>
    </aside>
  );
}
