"use client";

import { useEffect } from "react";
import { buildOutlookSignInUrl, openOutlookSignInDialog } from "@/components/m365/outlook-auth-gate";

/**
 * App Router error UI for the Outlook add-in entry.
 * Always offers Sign In — never a blank/crash pane.
 */
export default function OutlookAddinError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[SmartCRM /outlook-addin]", error);
  }, [error]);

  const signInUrl = buildOutlookSignInUrl();

  return (
    <div className="flex h-[100dvh] flex-col justify-center bg-white px-6">
      <div className="w-full max-w-sm border border-carbon-blue/10 bg-carbon-blue/[0.02] p-5">
        <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-upcycle-orange">
          SmartCRM
        </p>
        <p className="mt-2 text-sm font-semibold text-carbon-blue">Sign In to SmartCRM</p>
        <p className="mt-1 text-[11px] leading-relaxed text-carbon-blue/50">
          The task pane hit a temporary error. Sign in to reload relationship intelligence.
        </p>
        <button
          type="button"
          onClick={() => {
            void openOutlookSignInDialog(() => reset()).catch(() => {
              window.open(signInUrl, "_blank", "noopener,noreferrer");
            });
          }}
          className="mt-5 inline-flex w-full items-center justify-center border border-upcycle-orange bg-upcycle-orange px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-white transition-opacity hover:opacity-90"
        >
          Sign In to SmartCRM
        </button>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-2 inline-flex w-full items-center justify-center border border-carbon-blue/15 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
