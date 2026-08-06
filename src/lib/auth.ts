import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import AzureAD from "next-auth/providers/azure-ad";
import type { UserRole } from "@/types/auth";
import { isUserRole } from "@/types/auth";

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

const isProd = process.env.NODE_ENV === "production";
/** Auth.js v5 cookie prefix — must stay `authjs.*` (not v4 `next-auth.*`). */
const cookiePrefix = isProd ? "__Secure-" : "";

const azureClientId = process.env.AZURE_AD_CLIENT_ID || "";
const azureClientSecret = process.env.AZURE_AD_CLIENT_SECRET || "";
const azureTenantId = process.env.AZURE_AD_TENANT_ID || "common";

if (!process.env.NEXTAUTH_SECRET?.trim() && !process.env.AUTH_SECRET?.trim()) {
  console.warn(
    "[NextAuth] NEXTAUTH_SECRET/AUTH_SECRET missing — using fallback JWT secret. Set a real secret in Vercel.",
  );
}

if (!azureClientId || !azureClientSecret) {
  console.warn(
    "[NextAuth] AZURE_AD_CLIENT_ID / AZURE_AD_CLIENT_SECRET missing or empty — OAuth will fail until configured.",
  );
}

/**
 * Auth.js v5 Azure/Entra provider defaults to id `microsoft-entra-id`.
 * Force `azure-ad` so signIn("azure-ad") and redirect URI
 * `/api/auth/callback/azure-ad` match Azure app registration.
 *
 * Custom profile mapper skips Graph photo fetch (base64 blows JWT cookies)
 * and maps Entra email fallbacks (preferred_username / upn).
 */
function mapAzureAdProfile(profile: {
  sub?: string;
  name?: string | null;
  email?: string | null;
  preferred_username?: string | null;
  upn?: string | null;
}) {
  const email = String(
    profile.email || profile.preferred_username || profile.upn || "",
  ).toLowerCase();

  return {
    id: profile.sub || email || "unknown",
    name: profile.name || profile.preferred_username || "Standard Bio User",
    email,
    image: null,
  };
}

function buildAzureAdProvider() {
  const shared = {
    id: "azure-ad" as const,
    name: "Azure AD",
    // Explicit PKCE + state so Vercel HTTPS round-trips resolve cookies reliably.
    checks: ["pkce", "state"] as Array<"pkce" | "state">,
    authorization: {
      params: {
        scope: "openid profile email User.Read",
      },
    },
    profile: mapAzureAdProfile,
  };

  try {
    return AzureAD({
      ...shared,
      clientId: process.env.AZURE_AD_CLIENT_ID || "",
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET || "",
      // Auth.js v5 uses issuer (v4 tenantId). Always fall back to "common".
      issuer: `https://login.microsoftonline.com/${
        process.env.AZURE_AD_TENANT_ID || "common"
      }/v2.0`,
    } as Parameters<typeof AzureAD>[0]);
  } catch (error) {
    console.error(
      "[NextAuth] AzureAD provider init failed — using empty-client fallback",
      error instanceof Error ? error.message : String(error),
    );
    return AzureAD({
      ...shared,
      clientId: "",
      clientSecret: "",
      issuer: "https://login.microsoftonline.com/common/v2.0",
    } as Parameters<typeof AzureAD>[0]);
  }
}

/**
 * Shared Auth.js config — JWT only, no Prisma/database adapter.
 * Import this from the App Router route handler.
 */
export const authOptions: NextAuthConfig = {
  trustHost: true,
  secret:
    process.env.NEXTAUTH_SECRET ||
    process.env.AUTH_SECRET ||
    "smartcrm-production-jwt-secret-key-2026",
  // Always-on debug until OAuth callback is stable on Vercel (also logs in production).
  debug: process.env.NODE_ENV === "development" || true,
  session: {
    strategy: "jwt",
  },
  // Auth.js v5 cookie names (`authjs.*`). Explicit options help PKCE/state survive
  // the Azure AD → Vercel HTTPS redirect. Do not use v4 `next-auth.*` names here.
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-authjs.session-token"
          : "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    pkceCodeVerifier: {
      name: `${cookiePrefix}authjs.pkce.code_verifier`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: isProd,
        maxAge: 60 * 15,
      },
    },
    state: {
      name: `${cookiePrefix}authjs.state`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: isProd,
        maxAge: 60 * 15,
      },
    },
  },
  providers: [buildAzureAdProvider()],
  pages: {
    signIn: "/auth/signin",
    error: "/auth/signin",
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      try {
        // Log for debugging in Vercel — never block or await DB work here.
        console.log(
          "[NextAuth Callback] Successfully received OAuth payload for:",
          user?.email ||
            (profile as { email?: string } | undefined)?.email ||
            (profile as { preferred_username?: string } | undefined)?.preferred_username ||
            account?.providerAccountId,
        );
        return true;
      } catch (error) {
        console.error("[NextAuth Callback Error]", error);
        return true; // Never block sign-in on profile parse errors
      }
    },

    async jwt({ token, account, profile, user }) {
      try {
        console.log("[NextAuth DEBUG]", {
          event: "jwt",
          provider: account?.provider ?? null,
          hasAccessToken: Boolean(account?.access_token),
          userEmail: user?.email ?? null,
        });

        if (account?.access_token) token.azureAccessToken = account.access_token;
        if (account?.id_token) token.azureIdToken = account.id_token;
        if (account?.expires_at) token.azureAccessTokenExpiresAt = account.expires_at;

        const email = resolveAzureCallbackEmail(
          user,
          profile as Record<string, unknown> | null | undefined,
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
        // Keep JWT small — Entra profile photos are base64 and blow cookie size.
        if (typeof token.picture === "string" && token.picture.startsWith("data:")) {
          delete token.picture;
        }
        token.azureTenantId = azureTenantId;
        return token;
      } catch (error) {
        console.error(
          "[NextAuth DEBUG] jwt callback error — returning token as-is",
          error instanceof Error ? error.message : String(error),
        );
        return token;
      }
    },

    async session({ session, token }) {
      try {
        console.log("[NextAuth DEBUG]", {
          event: "session",
          user: session.user,
          account: null,
          profile: null,
        });

        if (session.user) {
          session.user.email =
            (token.email as string | undefined) ?? session.user.email ?? null;
          session.user.name =
            session.user.name ?? (token.name as string | undefined) ?? null;
          session.user.image =
            session.user.image ?? (token.picture as string | undefined) ?? null;
          const role = token.accessRole;
          session.user.role =
            typeof role === "string" && isUserRole(role) ? role : "commercial";
        }
        session.azureAccessToken =
          typeof token.azureAccessToken === "string" ? token.azureAccessToken : undefined;
        session.azureTenantId =
          typeof token.azureTenantId === "string" ? token.azureTenantId : azureTenantId;
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

/** Auth.js v5 App Router handlers — re-export as GET/POST from the route. */
export const { handlers, auth, signIn, signOut } = nextAuth;
export const { GET, POST } = handlers;
