/**
 * Safe NextAuth / Azure AD diagnostics — never logs secrets or tokens.
 */

export type AuthDebugSnapshot = {
  at: string;
  nodeEnv: string | undefined;
  urls: {
    AUTH_URL: boolean;
    NEXTAUTH_URL: boolean;
    AUTH_URL_value: string | null;
    NEXTAUTH_URL_value: string | null;
    NEXT_PUBLIC_APP_URL: string | null;
  };
  secrets: {
    NEXTAUTH_SECRET: boolean;
    AUTH_SECRET: boolean;
  };
  azure: {
    AZURE_AD_CLIENT_ID: boolean;
    AZURE_AD_CLIENT_SECRET: boolean;
    AZURE_AD_TENANT_ID: string;
    clientIdPrefix: string | null;
    issuer: string;
  };
  expectedCallbackUrl: string;
  notes: string[];
};

function present(value: string | undefined | null): boolean {
  return Boolean(value?.trim());
}

function publicOrigin(): string {
  return (
    process.env.AUTH_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "(unknown — set AUTH_URL)"
  ).replace(/\/$/, "");
}

export function buildAuthDebugSnapshot(): AuthDebugSnapshot {
  const origin = publicOrigin();
  const tenant =
    process.env.AZURE_AD_TENANT_ID?.trim() ||
    process.env.AZURE_TENANT_ID?.trim() ||
    "organizations";
  const clientId =
    process.env.AZURE_AD_CLIENT_ID?.trim() ||
    process.env.AZURE_CLIENT_ID?.trim() ||
    "";

  const notes: string[] = [];
  if (!present(process.env.AUTH_URL) && present(process.env.NEXTAUTH_URL)) {
    notes.push("AUTH_URL missing — Auth.js v5 prefers AUTH_URL over NEXTAUTH_URL.");
  }
  if (!present(process.env.AZURE_AD_CLIENT_SECRET)) {
    notes.push("AZURE_AD_CLIENT_SECRET missing at runtime.");
  }
  if (!present(process.env.NEXTAUTH_SECRET) && !present(process.env.AUTH_SECRET)) {
    notes.push("No NEXTAUTH_SECRET/AUTH_SECRET — using code fallback.");
  }
  if (tenant.includes(".") || tenant.includes("-")) {
    notes.push(
      `AZURE_AD_TENANT_ID="${tenant}" looks like a domain/GUID — issuer should use organizations/common.`,
    );
  }

  return {
    at: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
    urls: {
      AUTH_URL: present(process.env.AUTH_URL),
      NEXTAUTH_URL: present(process.env.NEXTAUTH_URL),
      AUTH_URL_value: process.env.AUTH_URL?.trim() || null,
      NEXTAUTH_URL_value: process.env.NEXTAUTH_URL?.trim() || null,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL?.trim() || null,
    },
    secrets: {
      NEXTAUTH_SECRET: present(process.env.NEXTAUTH_SECRET),
      AUTH_SECRET: present(process.env.AUTH_SECRET),
    },
    azure: {
      AZURE_AD_CLIENT_ID: present(process.env.AZURE_AD_CLIENT_ID) || Boolean(clientId),
      AZURE_AD_CLIENT_SECRET: present(process.env.AZURE_AD_CLIENT_SECRET),
      AZURE_AD_TENANT_ID: tenant,
      clientIdPrefix: clientId ? `${clientId.slice(0, 8)}…` : null,
      issuer: `https://login.microsoftonline.com/${
        tenant === "common" || tenant === "organizations" || tenant === "consumers"
          ? tenant
          : "organizations"
      }/v2.0`,
    },
    expectedCallbackUrl: `${origin}/api/auth/callback/azure-ad`,
    notes,
  };
}

export function authTrace(step: string, detail?: Record<string, unknown>): void {
  const payload = {
    step,
    at: new Date().toISOString(),
    ...detail,
  };
  console.log("[SmartCRM AuthTrace]", JSON.stringify(payload));
}
