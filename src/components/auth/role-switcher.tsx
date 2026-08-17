"use client";

import { UserSessionMenu } from "@/components/auth/user-session-menu";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import type { Company } from "@/lib/companies-data";

/**
 * Header actions: appearance + notifications + NextAuth session menu.
 * Hardcoded Access Tier / IT Admin dropdown removed.
 */
export function RoleSwitcher(_props: { companies?: Company[] } = {}) {
  return (
    <div className="flex items-center gap-2">
      <ThemeToggle />
      <NotificationBell />
      <UserSessionMenu />
    </div>
  );
}
