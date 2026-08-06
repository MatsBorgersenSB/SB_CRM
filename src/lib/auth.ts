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

function resolveEmailFromIdentity(input: {
  email?: string | null;
  preferred_username?: unknown;
  upn?: unknown;
  unique_name?: unknown;
}): string | undefined {
  const candidates = [
    input.email,
    typeof input.preferred_username === "string" ? input.preferred_username : null,
    typeof input.upn === "string" ? input.upn : null,
    typeof input.unique_name === "string" ? input.unique_name : null,
  ];
  for (const value of candidates) {
    const trimmed = value?.trim();
    if (trimmed && trimmed.includes("@")) return trimmed.toLowerCase();
  }
  return undefined;
}

function resolveAccessRole(email: string | null | undefined): UserRole {
  const domain = email ? extractEmailDomain(email) : "";
  if (domain && privilegedDomains().some((d) => domain === d || domain.endsWith(`.${d}`))) {
    return "superuser";
  }
  return "commercial";
}

async function ensureSessionUserRecord(input: {
  email?: string | null;
  name?: string | null;
  providerAccountId?: string | null;
}): Promise<void> {
  try {
    console.log("[NextAuth DEBUG] ensureSessionUserRecord", {
      email: input.email ?? null,
      name: input.name ?? null,
      providerAccountId: input.providerAccountId ?? null,
      note: "JWT strategy — no database adapter; identity lives in the session token.",
    });
  } catch (error) {
    console.error("[NextAuth DEBUG] ensureSessionUserRecord failed (non-fatal)", error);
  }
}

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
 */
function buildAzureAdProvider() {
  try {
    return AzureAD({
      id: "azure-ad",
      name: "Azure AD",
      clientId: process.env.AZURE_AD_CLIENT_ID || "",
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET || "",
      // v5 uses issuer (not v4 tenantId) — derived from tenant with safe fallback.
      issuer: `https://login.microsoftonline.com/${
        process.env.AZURE_AD_TENANT_ID || "common"
      }/v2.0`,
      authorization: {
        params: {
          scope: "openid profile email User.Read",
        },
      },
    });
  } catch (error) {
    console.error(
      "[NextAuth] AzureAD provider init failed — using empty-client fallback",
      error instanceof Error ? error.message : String(error),
    );
    return AzureAD({
      id: "azure-ad",
      name: "Azure AD",
      clientId: "",
      clientSecret: "",
      issuer: "https://login.microsoftonline.com/common/v2.0",
      authorization: {
        params: {
          scope: "openid profile email User.Read",
        },
      },
    });
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
  debug: process.env.AUTH_DEBUG === "1" || process.env.NODE_ENV !== "production",
  session: {
    strategy: "jwt",
  },
  providers: [buildAzureAdProvider()],
  pages: {
    signIn: "/auth/signin",
    error: "/auth/signin",
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      try {
        console.log("[NextAuth DEBUG]", { event: "signIn", user, account, profile });

        const email = resolveEmailFromIdentity({
          email: user?.email,
          preferred_username:
            profile && "preferred_username" in profile
              ? (profile as { preferred_username?: string }).preferred_username
              : undefined,
          upn: profile && "upn" in profile ? (profile as { upn?: string }).upn : undefined,
        });

        if (account?.provider === "azure-ad" || account?.provider === "microsoft-entra-id") {
          await ensureSessionUserRecord({
            email: email ?? user?.email,
            name: user?.name,
            providerAccountId: account.providerAccountId,
          });
        }

        return true;
      } catch (error) {
        console.error("[NextAuth DEBUG] signIn callback error — allowing sign-in", {
          error: error instanceof Error ? error.message : String(error),
          userEmail: user?.email ?? null,
          provider: account?.provider ?? null,
        });
        return true;
      }
    },

    async jwt({ token, account, profile, user }) {
      try {
        console.log("[NextAuth DEBUG]", {
          event: "jwt",
          user,
          account: account
            ? {
                provider: account.provider,
                type: account.type,
                providerAccountId: account.providerAccountId,
                hasAccessToken: Boolean(account.access_token),
              }
            : null,
          profile,
        });

        if (account?.access_token) token.azureAccessToken = account.access_token;
        if (account?.id_token) token.azureIdToken = account.id_token;
        if (account?.expires_at) token.azureAccessTokenExpiresAt = account.expires_at;

        const email =
          resolveEmailFromIdentity({
            email: (typeof token.email === "string" ? token.email : null) ?? user?.email,
            preferred_username:
              profile && "preferred_username" in profile
                ? (profile as { preferred_username?: string }).preferred_username
                : undefined,
            upn: profile && "upn" in profile ? (profile as { upn?: string }).upn : undefined,
            unique_name:
              profile && "unique_name" in profile
                ? (profile as { unique_name?: string }).unique_name
                : undefined,
          }) ?? (typeof token.email === "string" ? token.email : undefined);

        if (email) {
          token.email = email;
          if (!token.accessRole || typeof token.accessRole !== "string") {
            token.accessRole = resolveAccessRole(email);
          }
        } else if (!token.accessRole) {
          token.accessRole = "commercial";
        }

        if (user?.name && !token.name) token.name = user.name;
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
