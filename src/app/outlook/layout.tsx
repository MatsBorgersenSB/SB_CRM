import Script from "next/script";
import type { ReactNode } from "react";

/**
 * Outlook dialog + task-pane routes under /outlook/*.
 * Office.js must load before any Office.context / messageParent usage
 * (auth-complete, dialog SSO). beforeInteractive avoids the common
 * "Office.js has not fully loaded" race in Outlook Web.
 */
export default function OutlookLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Script
        src="https://appsforoffice.microsoft.com/lib/1/hosted/office.js"
        strategy="beforeInteractive"
      />
      <div className="h-[100dvh] overflow-hidden bg-white text-carbon-blue">{children}</div>
    </>
  );
}
