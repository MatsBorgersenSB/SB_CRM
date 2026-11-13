import { buildOutlookSignInPath } from "@/lib/outlook-addin-shell";
import {
  OUTLOOK_CONNECT_BODY,
  OUTLOOK_CONNECT_TITLE,
} from "@/lib/m365/outlook-connect-copy";

/**
 * Static Connect markup for Outlook task panes.
 * Hidden while React owns the UI; hydration watchdog reveals it if the gate never mounts.
 * The <a> works without JavaScript.
 */
export function OutlookStaticSignInFallback() {
  const signInUrl = buildOutlookSignInPath("");

  return (
    <div
      id="smartcrm-outlook-signin-fallback"
      hidden
      className="fixed inset-0 z-[9999] h-[100dvh] flex-col justify-center bg-white px-6"
      style={{ display: "none" }}
    >
      <div className="w-full max-w-sm border border-carbon-blue/10 bg-carbon-blue/[0.02] p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-upcycle-orange">
          SmartCRM
        </p>
        <p className="mt-2 text-sm font-semibold text-carbon-blue">{OUTLOOK_CONNECT_TITLE}</p>
        <p className="mt-1 text-[12px] leading-relaxed text-carbon-blue/50">
          {OUTLOOK_CONNECT_BODY}
        </p>
        <a
          href={signInUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex w-full items-center justify-center border border-upcycle-orange bg-upcycle-orange px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-white"
        >
          {OUTLOOK_CONNECT_TITLE}
        </a>
        <p className="mt-3 text-center text-[11px] text-carbon-blue/60">
          If this pane stayed on Connecting, open Connect above.
        </p>
      </div>
    </div>
  );
}
