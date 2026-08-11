import {
  outlookHistoryPolyfillScript,
  outlookHydrationWatchdogScript,
  OUTLOOK_HYDRATION_WATCHDOG_MS,
} from "@/lib/outlook-addin-shell";

/**
 * Inline History polyfill for Outlook route layouts.
 * Root layout also installs via next/script beforeInteractive; this duplicate
 * runs as a blocking inline script in the Outlook shell in case of injection order quirks.
 */
export function OutlookHistoryPolyfillScript() {
  return (
    <script
      id="smartcrm-outlook-history-polyfill-inline"
      dangerouslySetInnerHTML={{ __html: outlookHistoryPolyfillScript() }}
    />
  );
}

export function OutlookHydrationWatchdog() {
  return (
    <script
      id="smartcrm-outlook-hydration-watchdog"
      dangerouslySetInnerHTML={{
        __html: outlookHydrationWatchdogScript(OUTLOOK_HYDRATION_WATCHDOG_MS),
      }}
    />
  );
}
