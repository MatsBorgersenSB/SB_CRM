import type { ReactNode } from "react";
import { TeamsAuthShell } from "@/components/m365/teams-auth-shell";

/**
 * FS-018 Teams hosts — personal app + meeting side panel.
 * Silent Teams SSO first; Connect only when the quiet path fails.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function TeamsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-[100dvh] overflow-hidden bg-background text-carbon-blue">
      <TeamsAuthShell>{children}</TeamsAuthShell>
    </div>
  );
}
