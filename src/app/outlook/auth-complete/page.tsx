"use client";

import { useEffect } from "react";

/**
 * Office Dialog landing page after SmartCRM SSO.
 * Posts `authenticated` to the parent task pane and closes.
 */
export default function OutlookAuthCompletePage() {
  useEffect(() => {
    const notify = () => {
      try {
        const office = typeof Office !== "undefined" ? Office : undefined;
        office?.context?.ui?.messageParent?.("authenticated");
      } catch {
        /* not hosted in Office dialog */
      }
      window.setTimeout(() => {
        try {
          window.close();
        } catch {
          /* ignore */
        }
      }, 400);
    };

    const office = typeof Office !== "undefined" ? Office : undefined;
    if (office?.onReady) {
      office.onReady(() => notify());
    } else {
      notify();
    }
  }, []);

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-white px-6 text-center">
      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-upcycle-orange">
        SmartCRM
      </p>
      <h1 className="mt-2 text-base font-semibold text-carbon-blue">You&apos;re signed in</h1>
      <p className="mt-1 max-w-sm text-[12px] text-carbon-blue/50">
        You can close this window and return to Outlook.
      </p>
    </main>
  );
}
