import {
  buildOutlookSignInPath,
} from "@/lib/outlook-addin-shell";

/**
 * Static Sign In markup for Outlook task panes.
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
        <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-upcycle-orange">
          SmartCRM
        </p>
        <p className="mt-2 text-sm font-semibold text-carbon-blue">Sign In to SmartCRM</p>
        <p className="mt-1 text-[11px] leading-relaxed text-carbon-blue/50">
          Relationship intelligence stays in SmartCRM. Sign in with your Microsoft work account —
          then this pane answers what matters and what to do next.
        </p>
        <a
          href={signInUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex w-full items-center justify-center border border-upcycle-orange bg-upcycle-orange px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-white"
        >
          Sign In to SmartCRM
        </a>
        <p className="mt-3 text-center text-[10px] text-carbon-blue/40">
          If this pane stayed on Connecting, open sign-in above.
        </p>
      </div>
    </div>
  );
}
