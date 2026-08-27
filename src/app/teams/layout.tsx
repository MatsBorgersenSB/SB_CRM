import type { ReactNode } from "react";

/**
 * FS-018 Teams hosts — personal app + meeting side panel.
 * Pages load without a session so they can show Sign-in CTA (same pattern as Outlook).
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function TeamsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-[100dvh] overflow-hidden bg-background text-carbon-blue">
      {children}
    </div>
  );
}
