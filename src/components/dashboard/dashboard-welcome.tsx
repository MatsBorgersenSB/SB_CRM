"use client";

import Link from "next/link";
import { formatDashboardDate, getWelcomeGreeting } from "@/lib/relationship-intelligence";
import type { AuthUser } from "@/types/auth";

export function DashboardWelcome({ user }: { user: AuthUser }) {
  return (
    <header>
      <h1 className="text-2xl font-semibold tracking-tight text-carbon-blue sm:text-[1.65rem]">
        {getWelcomeGreeting(user.displayName)}
      </h1>
      <p className="mt-1 text-sm text-carbon-blue/50">{formatDashboardDate()}</p>
    </header>
  );
}
