import type { ReactNode } from "react";
import { OutlookStaticSignInFallback } from "@/components/m365/outlook-static-sign-in-fallback";
import {
  OutlookHistoryPolyfillScript,
  OutlookHydrationWatchdog,
} from "@/components/m365/outlook-history-polyfill";

/**
 * Outlook dialog + task-pane routes under /outlook/* (relationship card, briefing, auth-complete).
 *
 * Critical: History API polyfill before Next hydrate — Outlook Web stubs History.
 * Office.js loads on demand via whenOfficeReady / messageParentSafe.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function OutlookLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <OutlookHistoryPolyfillScript />
      <OutlookHydrationWatchdog />
      <OutlookStaticSignInFallback />
      <div className="h-[100dvh] overflow-hidden bg-white text-carbon-blue">{children}</div>
    </>
  );
}
