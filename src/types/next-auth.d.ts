import type { UserRole } from "@/types/auth";

declare module "next-auth" {
  interface User {
    role?: UserRole;
  }

  interface Session {
    user: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: UserRole;
    };
    azureAccessToken?: string;
    azureTenantId?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    azureAccessToken?: string;
    azureIdToken?: string;
    azureAccessTokenExpiresAt?: number;
    azureTenantId?: string;
    accessRole?: UserRole;
  }
}
