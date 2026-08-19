/**
 * Canonical production origin for SmartCRM web + Outlook add-in.
 * Sideloaded manifests and AUTH_URL / NEXT_PUBLIC_APP_URL must match this host.
 * Do not use the retired Vercel project smart-crm-outlook-plugin-phi.
 */
export const SMARTCRM_PRODUCTION_ORIGIN = "https://sb-crm-seven.vercel.app";
export const SMARTCRM_PRODUCTION_HOST = "sb-crm-seven.vercel.app";

/** Retired Outlook hosting — if task panes load here, re-sideload the current manifest. */
export const SMARTCRM_RETIRED_OUTLOOK_HOSTS = [
  "smart-crm-outlook-plugin-phi.vercel.app",
] as const;

export function isRetiredOutlookHost(hostnameOrOrigin: string): boolean {
  const host = hostnameOrOrigin
    .replace(/^https?:\/\//i, "")
    .split("/")[0]
    ?.toLowerCase();
  if (!host) return false;
  return SMARTCRM_RETIRED_OUTLOOK_HOSTS.some(
    (retired) => host === retired || host.endsWith(`.${retired}`),
  );
}

/**
 * Outlook add-in must run on the canonical production host.
 * Preview Vercel hosts can complete Microsoft sign-in but then loop because the
 * task-pane session bridge/cookies stay on the wrong host.
 */
export function isUnsupportedOutlookHost(hostnameOrOrigin: string): boolean {
  const host = hostnameOrOrigin
    .replace(/^https?:\/\//i, "")
    .split("/")[0]
    ?.toLowerCase();
  if (!host) return false;
  if (host === SMARTCRM_PRODUCTION_HOST) return false;
  if (isRetiredOutlookHost(host)) return true;
  // Any other Vercel preview/custom generated host is unsupported for Outlook.
  if (host.endsWith(".vercel.app")) return true;
  return false;
}

export function resolvePublicAppOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  return SMARTCRM_PRODUCTION_ORIGIN;
}
