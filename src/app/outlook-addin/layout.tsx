import type { ReactNode } from "react";
import { OutlookStaticSignInFallback } from "@/components/m365/outlook-static-sign-in-fallback";
import {
  OutlookHistoryPolyfillScript,
  OutlookHydrationWatchdog,
} from "@/components/m365/outlook-history-polyfill";

/**
 * Outlook add-in task pane shell (manifest SourceLocation → /outlook-addin).
 *
 * Critical: History API polyfill must run before Next hydrates. Outlook Web stubs
 * pushState/replaceState so App Router throws and Sign In never appears.
 *
 * Office.js loads on demand via whenOfficeReady() — not beforeInteractive.
 * force-dynamic: avoid CDN-cached prerender of a stale Connecting state.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function OutlookAddinLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <OutlookHistoryPolyfillScript />
      <OutlookHydrationWatchdog />
      <OutlookStaticSignInFallback />
      <div className="h-[100dvh] overflow-hidden bg-background text-carbon-blue">{children}</div>
    </>
  );
}
