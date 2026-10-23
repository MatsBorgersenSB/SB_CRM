"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSession } from "next-auth/react";
import { authUserToAccountOwner } from "@/lib/company-owner";
import type { AuthUser, UserRole } from "@/types/auth";
import { isUserRole } from "@/types/auth";

type AuthContextValue = {
  user: AuthUser;
  setRole: (role: UserRole) => void;
  setCompanyId: (companyId: string | undefined) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const ROLE_COMPANY_DEFAULTS: Partial<Record<UserRole, string>> = {
  client_lead: "CO-1001",
};

const GUEST_USER: AuthUser = {
  id: 0,
  displayName: "Guest",
  role: "commercial",
};

/**
 * App auth context — identity comes from NextAuth Azure AD session.
 */
export function AuthProvider({
  children,
  initialUser = GUEST_USER,
}: {
  children: ReactNode;
  initialUser?: AuthUser;
}) {
  const { data: session, status } = useSession();
  const [user, setUser] = useState<AuthUser>(initialUser);

  useEffect(() => {
    if (status === "loading") return;

    if (!session?.user) {
      setUser(GUEST_USER);
      return;
    }

    const sessionRole = session.user.role;
    const nextRole =
      sessionRole && isUserRole(sessionRole) ? sessionRole : ("commercial" as UserRole);
    const displayName =
      session.user.name?.trim() || session.user.email?.trim() || "Microsoft 365 user";
    const email = session.user.email?.trim() || undefined;
    const owner = authUserToAccountOwner({
      id: 0,
      displayName,
      email,
      role: nextRole,
    });

    setUser((current) => {
      const next: AuthUser = {
        id: owner.Id,
        displayName: owner.Title || displayName,
        email,
        image: session.user.image ?? null,
        role: nextRole,
        companyId:
          nextRole === "client_lead"
            ? (current.companyId ?? ROLE_COMPANY_DEFAULTS.client_lead)
            : undefined,
      };
      if (
        current.id === next.id &&
        current.displayName === next.displayName &&
        current.email === next.email &&
        current.image === next.image &&
        current.role === next.role &&
        current.companyId === next.companyId
      ) {
        return current;
      }
      return next;
    });
  }, [session, status]);

  const setRole = useCallback((role: UserRole) => {
    setUser((current) => ({
      ...current,
      role,
      companyId:
        role === "client_lead"
          ? (current.companyId ?? ROLE_COMPANY_DEFAULTS.client_lead)
          : undefined,
    }));
  }, []);

  const setCompanyId = useCallback((companyId: string | undefined) => {
    setUser((current) => ({ ...current, companyId }));
  }, []);

  const value = useMemo(
    () => ({ user, setRole, setCompanyId }),
    [user, setRole, setCompanyId],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
