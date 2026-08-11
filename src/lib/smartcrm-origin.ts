/**
 * Canonical production origin for SmartCRM web + Outlook add-in.
 * Sideloaded manifests and AUTH_URL / NEXT_PUBLIC_APP_URL must match this host.
 * Do not use the retired Vercel project smart-crm-outlook-plugin-phi.
 */
export const SMARTCRM_PRODUCTION_ORIGIN = "https://sb-crm-seven.vercel.app";

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

export function resolvePublicAppOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  return SMARTCRM_PRODUCTION_ORIGIN;
}
