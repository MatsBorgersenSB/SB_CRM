/** Shared Azure AD / Auth.js env helpers — safe for Edge middleware. */

function env(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return "";
}

export function getAzureAdClientId(): string {
  return env("AZURE_AD_CLIENT_ID", "AZURE_CLIENT_ID", "AUTH_MICROSOFT_ENTRA_ID_ID");
}

export function getAzureAdClientSecret(): string {
  return env(
    "AZURE_AD_CLIENT_SECRET",
    "AZURE_CLIENT_SECRET",
    "AUTH_MICROSOFT_ENTRA_ID_SECRET",
  );
}

export function getAzureAdTenantId(): string {
  return env(
    "AZURE_AD_TENANT_ID",
    "AZURE_TENANT_ID",
    "AUTH_MICROSOFT_ENTRA_ID_TENANT_ID",
  );
}

/**
 * Prefer NEXTAUTH_SECRET, then AUTH_SECRET.
 * Always return a string so Auth.js never throws MissingSecret / Configuration.
 */
export function resolveAuthSecret(): string {
  return (
    process.env.NEXTAUTH_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    "fallback-secret-key-for-jwt"
  );
}
