"use client";

import type { ReactNode } from "react";
import { TeamsAuthGate } from "@/components/m365/teams-auth-gate";

/** Client wrapper so the Teams layout can keep being a server component. */
export function TeamsAuthShell({ children }: { children: ReactNode }) {
  return <TeamsAuthGate>{children}</TeamsAuthGate>;
}
