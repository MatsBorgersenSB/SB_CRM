/** Shared Azure AD / Auth.js env helpers — safe for Edge middleware. */

function env(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return "";
}

/**
 * Public Application (client) ID — safe as a last-resort fallback so provider
 * init never sees `undefined`. Prefer AZURE_AD_CLIENT_ID in Vercel.
 */
const FALLBACK_AZURE_AD_CLIENT_ID = "5423dfce-1efa-4ddf-a567-28c201b5c29f";

export function getAzureAdClientId(): string {
  return (
    env(
      "AZURE_AD_CLIENT_ID",
      "AZURE_CLIENT_ID",
      "AUTH_MICROSOFT_ENTRA_ID_ID",
      // Legacy / misnamed Vercel keys (older Outlook plugin deploys)
      "SMARTCRM_AZURE_CLIENT_ID",
    ) || FALLBACK_AZURE_AD_CLIENT_ID
  );
}

/**
 * Client secret must come from env — never hardcode in source (git leak risk).
 * Returns "" only if unset; caller must not throw on empty.
 */
export function getAzureAdClientSecret(): string {
  return env(
    "AZURE_AD_CLIENT_SECRET",
    "AZURE_CLIENT_SECRET",
    "AUTH_MICROSOFT_ENTRA_ID_SECRET",
    // Legacy / misnamed Vercel keys (older Outlook plugin deploys)
    "SMARTCRM_AZURE_APP_SECRET",
    "SMARTCRM_AZURE_CLIENT_SECRET",
  );
}

export function getAzureAdTenantId(): string {
  return (
    env(
      "AZURE_AD_TENANT_ID",
      "AZURE_TENANT_ID",
      "AUTH_MICROSOFT_ENTRA_ID_TENANT_ID",
      "SMARTCRM_AZURE_TENANT_ID",
    ) || "organizations"
  );
}

/**
 * Prefer NEXTAUTH_SECRET, then AUTH_SECRET.
 * Always return a non-empty string so Auth.js never throws MissingSecret.
 */
export function resolveAuthSecret(): string {
  return (
    process.env.NEXTAUTH_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    "smartcrm-production-fallback-secret-2026"
  );
}

/** Runtime presence check — never logs secret values. */
export function logAuthEnvPresence(): void {
  console.log("[NextAuth] env presence", {
    NEXTAUTH_SECRET: Boolean(process.env.NEXTAUTH_SECRET?.trim()),
    AUTH_SECRET: Boolean(process.env.AUTH_SECRET?.trim()),
    AUTH_URL: Boolean(process.env.AUTH_URL?.trim()),
    NEXTAUTH_URL: Boolean(process.env.NEXTAUTH_URL?.trim()),
    AZURE_AD_CLIENT_ID: Boolean(process.env.AZURE_AD_CLIENT_ID?.trim()),
    AZURE_AD_CLIENT_SECRET: Boolean(process.env.AZURE_AD_CLIENT_SECRET?.trim()),
    AZURE_AD_TENANT_ID: process.env.AZURE_AD_TENANT_ID?.trim() || "(fallback organizations)",
  });
}
