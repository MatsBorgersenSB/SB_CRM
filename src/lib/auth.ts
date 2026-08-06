import NextAuth from "next-auth";
import AzureAD from "next-auth/providers/azure-ad";
import type { UserRole } from "@/types/auth";
import { isUserRole } from "@/types/auth";
import {
  getAzureAdClientId,
  getAzureAdClientSecret,
  getAzureAdTenantId,
  isAzureAdAuthConfigured,
} from "@/lib/auth-env";

export {
  getAzureAdClientId,
  getAzureAdClientSecret,
  getAzureAdTenantId,
  isAzureAdAuthConfigured,
} from "@/lib/auth-env";

const AZURE_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "User.Read",
  "Sites.ReadWrite.All",
  "Mail.Send",
].join(" ");

function internalDomains(): string[] {
  return (process.env.INTERNAL_DOMAINS ?? "standardbio.com")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

function resolveAccessRole(email: string | null | undefined): UserRole {
  const normalized = (email ?? "").trim().toLowerCase();
  const domain = normalized.includes("@") ? normalized.split("@")[1]! : "";
  if (domain && internalDomains().includes(domain)) {
    return "superuser";
  }
  return "commercial";
}

const tenantId = getAzureAdTenantId() || "common";
const issuer = `https://login.microsoftonline.com/${tenantId}/v2.0`;

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  providers: [
    AzureAD({
      clientId: getAzureAdClientId(),
      clientSecret: getAzureAdClientSecret(),
      issuer,
      authorization: {
        params: {
          scope: AZURE_SCOPES,
        },
      },
    }),
  ],
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account?.access_token) {
        token.azureAccessToken = account.access_token;
      }
      if (account?.id_token) {
        token.azureIdToken = account.id_token;
      }
      if (account?.expires_at) {
        token.azureAccessTokenExpiresAt = account.expires_at;
      }

      const email =
        (typeof token.email === "string" && token.email) ||
        (profile && "email" in profile && typeof profile.email === "string"
          ? profile.email
          : undefined);

      if (email) {
        token.email = email;
        if (!token.accessRole || typeof token.accessRole !== "string") {
          token.accessRole = resolveAccessRole(email);
        }
      }

      token.azureTenantId = tenantId;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = (token.email as string | undefined) ?? session.user.email;
        session.user.name = session.user.name ?? (token.name as string | undefined) ?? null;
        session.user.image =
          session.user.image ?? (token.picture as string | undefined) ?? null;
        const role = token.accessRole;
        session.user.role =
          typeof role === "string" && isUserRole(role) ? role : "commercial";
      }
      session.azureAccessToken =
        typeof token.azureAccessToken === "string" ? token.azureAccessToken : undefined;
      session.azureTenantId =
        typeof token.azureTenantId === "string" ? token.azureTenantId : tenantId;
      return session;
    },
  },
});
