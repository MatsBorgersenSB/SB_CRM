import NextAuth, { customFetch } from "next-auth";
import type { NextAuthConfig } from "next-auth";
import AzureAD from "next-auth/providers/azure-ad";
import type { UserRole } from "@/types/auth";
import { isUserRole } from "@/types/auth";
import {
  getAzureAdClientId,
  getAzureAdClientSecret,
  getAzureAdTenantId,
  logAuthEnvPresence,
  resolveAuthSecret,
} from "@/lib/auth-env";

/** Domains that receive elevated SmartCRM access (not a sign-in allowlist). */
const STANDARD_BIO_DOMAINS = [
  "standard.bio",
  "standardbio.com",
  "standardbio.no",
] as const;

function envInternalDomains(): string[] {
  return (process.env.INTERNAL_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase().replace(/^@+/, "").replace(/\.+$/, ""))
    .filter(Boolean);
}

function privilegedDomains(): string[] {
  const fromEnv = envInternalDomains();
  const merged = new Set<string>([...STANDARD_BIO_DOMAINS, ...fromEnv]);
  return [...merged];
}

function extractEmailDomain(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at < 0 || at === trimmed.length - 1) return "";
  return trimmed.slice(at + 1).replace(/\.+$/, "");
}

/**
 * Azure AD / Entra often omits `user.email` on first callback.
 * Fall back to profile claims; never throw on missing/odd types.
 */
function resolveAzureCallbackEmail(
  user?: { email?: string | null } | null,
  profile?: Record<string, unknown> | null,
  fallback?: string | null,
): string {
  try {
    const email = (
      user?.email ||
      (typeof profile?.email === "string" ? profile.email : "") ||
      (profile as { preferred_username?: string } | null | undefined)?.preferred_username ||
      (profile as { upn?: string } | null | undefined)?.upn ||
      (profile as { unique_name?: string } | null | undefined)?.unique_name ||
      fallback ||
      ""
    );
    return String(email).toLowerCase().trim();
  } catch {
    return "";
  }
}

function resolveAccessRole(email: string | null | undefined): UserRole {
  const domain = email ? extractEmailDomain(email) : "";
  if (domain && privilegedDomains().some((d) => domain === d || domain.endsWith(`.${d}`))) {
    return "superuser";
  }
  return "commercial";
}

/**
 * Auth.js azure-ad callback rewrites the issuer with regex
 * `/microsoftonline\.com\/(\w+)\/v2\.0/` then swaps that segment for the
 * id_token `tid`. Only `common` | `organizations` | `consumers` match `\w+`
 * safely — GUIDs (hyphens) and domains (dots) produce a broken issuer and
 * OAuthCallbackError after Microsoft approval.
 */
function resolveAzureIssuer(): string {
  const explicit =
    process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER?.trim() ||
    process.env.AZURE_AD_ISSUER?.trim();
  if (explicit) {
    try {
      const url = new URL(explicit);
      const segment = url.pathname.split("/").filter(Boolean)[0] ?? "";
      if (segment === "common" || segment === "organizations" || segment === "consumers") {
        return `${url.origin}/${segment}/v2.0`;
      }
      console.warn(
        `[NextAuth] Issuer tenant segment "${segment}" is unsafe for Auth.js azure-ad rewrite — using organizations.`,
      );
    } catch {
      console.warn("[NextAuth] Invalid AUTH_MICROSOFT_ENTRA_ID_ISSUER — using organizations.");
    }
  }

  const tenant = (
    process.env.AZURE_AD_TENANT_ID ||
    getAzureAdTenantId() ||
    "organizations"
  ).trim();

  if (tenant === "common" || tenant === "organizations" || tenant === "consumers") {
    return `https://login.microsoftonline.com/${tenant}/v2.0`;
  }

  // Domain or GUID — do not put into issuer path (breaks Auth.js \w+ rewrite).
  console.warn(
    `[NextAuth] AZURE_AD_TENANT_ID="${tenant}" is not safe in issuer path; using organizations. Prefer setting AUTH_MICROSOFT_ENTRA_ID_ISSUER=https://login.microsoftonline.com/organizations/v2.0`,
  );
  return "https://login.microsoftonline.com/organizations/v2.0";
}

const azureClientId = process.env.AZURE_AD_CLIENT_ID?.trim() || getAzureAdClientId();
const azureClientSecret =
  process.env.AZURE_AD_CLIENT_SECRET?.trim() || getAzureAdClientSecret();
const azureTenantId =
  process.env.AZURE_AD_TENANT_ID?.trim() || getAzureAdTenantId() || "organizations";
const azureIssuer = resolveAzureIssuer();

logAuthEnvPresence();

if (!process.env.NEXTAUTH_SECRET?.trim() && !process.env.AUTH_SECRET?.trim()) {
  console.warn(
    "[NextAuth] NEXTAUTH_SECRET/AUTH_SECRET missing — using fallback JWT secret. Set a real secret in Vercel.",
  );
}

if (!azureClientSecret) {
  console.error(
    "[NextAuth] AZURE_AD_CLIENT_SECRET is empty at runtime. Set it in Vercel → Settings → Environment Variables, then Redeploy. Do not commit the secret to git.",
  );
}

console.log("[NextAuth] Azure issuer configured:", azureIssuer, {
  clientIdPrefix: azureClientId.slice(0, 8),
  tenantId: azureTenantId,
  hasClientSecret: Boolean(azureClientSecret),
});

/**
 * Auth.js v5 Azure/Entra provider defaults to id `microsoft-entra-id`.
 * Force `azure-ad` so signIn("azure-ad") and redirect URI
 * `/api/auth/callback/azure-ad` match Azure app registration.
 */
function mapAzureAdProfile(profile: {
  sub?: string;
  name?: string | null;
  email?: string | null;
  preferred_username?: string | null;
  upn?: string | null;
}) {
  return {
    id: profile.sub || "unknown",
    name: profile.name || profile.preferred_username || "Standard Bio User",
    email: (profile.email || profile.preferred_username || profile.upn || "").toLowerCase(),
    image: null,
  };
}

/**
 * Auth.js Entra provider replaces `{tenantid}` in discovery using config.issuer
 * with a `\w+` regex — that breaks after Microsoft returns a real tenant GUID.
 * Use the tenant segment from the discovery URL being requested instead.
 */
async function azureDiscoveryFetch(
  ...args: Parameters<typeof fetch>
): Promise<Response> {
  const input = args[0];
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.pathname.endsWith(".well-known/openid-configuration")) {
    const response = await fetch(...args);
    const json = (await response.clone().json()) as { issuer?: string };
    const tenantId =
      url.pathname.match(/\/([^/]+)\/v2\.0\//)?.[1] ??
      url.href.match(/microsoftonline\.com\/([^/]+)\/v2\.0/)?.[1] ??
      "organizations";
    const issuer = String(json.issuer ?? "").replace("{tenantid}", tenantId);
    console.log("[NextAuth] Entra discovery issuer rewrite:", { tenantId, issuer });
    return Response.json({ ...json, issuer });
  }
  return fetch(...args);
}

function buildAzureAdProvider() {
  // Never pass undefined — Auth.js treats missing clientId as Configuration error.
  const clientId = azureClientId || "5423dfce-1efa-4ddf-a567-28c201b5c29f";
  // Secret must stay in env only. Empty string keeps startup alive; sign-in will fail clearly.
  const clientSecret = azureClientSecret || "";
  const tenantId = azureTenantId || "organizations";
  const issuer =
    azureIssuer || `https://login.microsoftonline.com/${tenantId}/v2.0`;

  const shared = {
    id: "azure-ad" as const,
    name: "Azure AD",
    // Bypass state/PKCE cookies — Vercel often loses them across Microsoft redirect.
    checks: ["none"] as Array<"pkce" | "state" | "none">,
    // Microsoft Entra prefers POST body client auth; Basic often → invalid_client.
    client: { token_endpoint_auth_method: "client_secret_post" as const },
    authorization: {
      params: {
        scope: "openid profile email User.Read",
      },
    },
    profile: mapAzureAdProfile,
    // Override broken Auth.js discovery tenant substitution (root OAuthCallbackError).
    [customFetch]: azureDiscoveryFetch,
  };

  try {
    const provider = AzureAD({
      ...shared,
      clientId,
      clientSecret,
      issuer,
    } as Parameters<typeof AzureAD>[0]);
    if (!provider) {
      throw new Error("AzureAD() returned null/undefined");
    }
    return provider;
  } catch (error) {
    console.error(
      "[NextAuth] AzureAD provider init failed — using non-throwing fallback provider",
      error instanceof Error ? error.message : String(error),
    );
    return AzureAD({
      ...shared,
      clientId,
      clientSecret: clientSecret || "unset-client-secret",
      issuer: "https://login.microsoftonline.com/organizations/v2.0",
    } as Parameters<typeof AzureAD>[0]);
  }
}

/**
 * Outlook Web task panes are cross-site iframes. Auth.js defaults (SameSite=Lax)
 * mean cookies set in the Office Dialog never reach the task pane. Use
 * SameSite=None; Secure in production for dialog SSO cookies. The dialog-bridge
 * claim route adds Partitioned when writing the session into the Outlook iframe.
 */
function buildAuthCookies(): NextAuthConfig["cookies"] {
  const secure =
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL === "1" ||
    Boolean(process.env.AUTH_URL?.startsWith("https://")) ||
    Boolean(process.env.NEXTAUTH_URL?.startsWith("https://"));

  if (!secure) return undefined;

  const base = {
    httpOnly: true as const,
    sameSite: "none" as const,
    path: "/",
    secure: true,
  };

  return {
    sessionToken: {
      name: "__Secure-authjs.session-token",
      options: base,
    },
    callbackUrl: {
      name: "__Secure-authjs.callback-url",
      options: base,
    },
    csrfToken: {
      name: "__Host-authjs.csrf-token",
      options: base,
    },
    pkceCodeVerifier: {
      name: "__Secure-authjs.pkce.code_verifier",
      options: { ...base, maxAge: 60 * 15 },
    },
    state: {
      name: "__Secure-authjs.state",
      options: { ...base, maxAge: 60 * 15 },
    },
    nonce: {
      name: "__Secure-authjs.nonce",
      options: base,
    },
  };
}

const authCookies = buildAuthCookies();
const useSecureCookies = Boolean(authCookies);

/** Shared Auth.js config — JWT only, no Prisma/database adapter. */
export const authOptions: NextAuthConfig = {
  trustHost: true,
  // Must match middleware getToken({ secret }) exactly (including trim).
  secret: resolveAuthSecret(),
  debug: true,
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 8,
  },
  useSecureCookies,
  // Keep Auth.js cookie *names*; override SameSite for Office iframe / dialog SSO.
  cookies: authCookies,
  providers: [buildAzureAdProvider()],
  pages: {
    signIn: "/auth/signin",
    error: "/auth/signin",
  },
  logger: {
    error(error) {
      console.error("[NextAuth ERROR]", error);
      console.log(
        "[SmartCRM AuthTrace]",
        JSON.stringify({
          step: "logger.error",
          at: new Date().toISOString(),
          name: error instanceof Error ? error.name : typeof error,
          message: error instanceof Error ? error.message : String(error),
          cause:
            error instanceof Error && error.cause
              ? String(error.cause)
              : undefined,
        }),
      );
    },
    warn(code) {
      console.warn("[NextAuth WARN]", code);
      console.log(
        "[SmartCRM AuthTrace]",
        JSON.stringify({ step: "logger.warn", at: new Date().toISOString(), code }),
      );
    },
    debug(code, metadata) {
      console.log("[NextAuth DEBUG]", code, metadata);
    },
  },
  events: {
    async signIn(message) {
      console.log(
        "[SmartCRM AuthTrace]",
        JSON.stringify({
          step: "events.signIn",
          at: new Date().toISOString(),
          userEmail: message.user?.email ?? null,
          provider: message.account?.provider ?? null,
          isNewUser: message.isNewUser ?? null,
        }),
      );
    },
    async signOut() {
      console.log(
        "[SmartCRM AuthTrace]",
        JSON.stringify({ step: "events.signOut", at: new Date().toISOString() }),
      );
    },
    async session() {
      // noisy — only log occasionally via debug flag
      if (process.env.AUTH_DEBUG === "1") {
        console.log(
          "[SmartCRM AuthTrace]",
          JSON.stringify({ step: "events.session", at: new Date().toISOString() }),
        );
      }
    },
  },
  callbacks: {
    async redirect({ url, baseUrl }) {
      console.log(
        "[SmartCRM AuthTrace]",
        JSON.stringify({
          step: "callback.redirect",
          at: new Date().toISOString(),
          url,
          baseUrl,
        }),
      );
      try {
        if (url.startsWith("/")) return `${baseUrl}${url}`;
        const target = new URL(url);
        if (target.origin === baseUrl) return url;
      } catch {
        /* fall through */
      }
      return baseUrl;
    },

    async signIn({ user, account, profile }) {
      try {
        console.log(
          "[SmartCRM AuthTrace]",
          JSON.stringify({
            step: "callback.signIn",
            at: new Date().toISOString(),
            provider: account?.provider ?? null,
            userEmail: user?.email ?? null,
            profileEmail: (profile as { email?: string } | undefined)?.email ?? null,
            preferredUsername:
              (profile as { preferred_username?: string } | undefined)?.preferred_username ??
              null,
            hasAccessToken: Boolean(account?.access_token),
            hasIdToken: Boolean(account?.id_token),
          }),
        );
        return true;
      } catch (error) {
        console.error("[NextAuth Callback Error]", error);
        console.log(
          "[SmartCRM AuthTrace]",
          JSON.stringify({
            step: "callback.signIn.error",
            at: new Date().toISOString(),
            message: error instanceof Error ? error.message : String(error),
          }),
        );
        return true;
      }
    },

    async jwt({ token, account, profile, user, trigger }) {
      try {
        console.log(
          "[SmartCRM AuthTrace]",
          JSON.stringify({
            step: "callback.jwt",
            at: new Date().toISOString(),
            trigger: trigger ?? null,
            provider: account?.provider ?? null,
            userEmail: user?.email ?? null,
            tokenEmail: typeof token.email === "string" ? token.email : null,
            hasAccount: Boolean(account),
          }),
        );

        if (account) {
          // Do NOT store access_token / id_token in the JWT cookie — Entra tokens
          // blow past 4KB and Vercel drops the Set-Cookie → silent logout.
          token.azureAccessTokenExpiresAt = account.expires_at;
          token.azureTenantId = azureTenantId;
          if (account.providerAccountId) {
            token.azureOid = account.providerAccountId;
          }
        }

        const profileRecord = profile as Record<string, unknown> | null | undefined;
        const profileOid =
          (typeof profileRecord?.oid === "string" && profileRecord.oid) ||
          (typeof profileRecord?.sub === "string" && profileRecord.sub) ||
          null;
        if (profileOid) token.azureOid = profileOid;

        const email = resolveAzureCallbackEmail(
          user,
          profileRecord,
          typeof token.email === "string" ? token.email : null,
        );

        if (email) {
          token.email = email;
          if (!token.accessRole || typeof token.accessRole !== "string") {
            token.accessRole = resolveAccessRole(email);
          }
        } else if (!token.accessRole) {
          token.accessRole = "commercial";
        }

        if (user?.name && !token.name) token.name = user.name;
        if (typeof token.picture === "string" && token.picture.startsWith("data:")) {
          delete token.picture;
        }
        if (!token.azureTenantId) token.azureTenantId = azureTenantId;
        return token;
      } catch (error) {
        console.error(
          "[NextAuth DEBUG] jwt callback error — returning token as-is",
          error instanceof Error ? error.message : String(error),
        );
        console.log(
          "[SmartCRM AuthTrace]",
          JSON.stringify({
            step: "callback.jwt.error",
            at: new Date().toISOString(),
            message: error instanceof Error ? error.message : String(error),
          }),
        );
        return token;
      }
    },

    async session({ session, token }) {
      try {
        if (session.user) {
          session.user.email =
            (token.email as string | undefined) ?? session.user.email ?? null;
          session.user.name =
            session.user.name ?? (token.name as string | undefined) ?? null;
          session.user.image = null;
          const role = token.accessRole;
          session.user.role =
            typeof role === "string" && isUserRole(role) ? role : "commercial";
        }
        session.azureTenantId =
          typeof token.azureTenantId === "string" ? token.azureTenantId : azureTenantId;
        session.azureOid =
          typeof token.azureOid === "string" ? token.azureOid : undefined;
        return session;
      } catch (error) {
        console.error(
          "[NextAuth DEBUG] session callback error — returning session as-is",
          error instanceof Error ? error.message : String(error),
        );
        return session;
      }
    },
  },
};

const nextAuth = NextAuth(authOptions);

export const { handlers, auth, signIn, signOut } = nextAuth;
export const { GET, POST } = handlers;
