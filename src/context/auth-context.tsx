"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSession } from "next-auth/react";
import { GUEST_USER, sessionToAuthUser } from "@/lib/session-user";
import type { AuthUser, UserRole } from "@/types/auth";

type AuthContextValue = {
  user: AuthUser;
  setRole: (role: UserRole) => void;
  setCompanyId: (companyId: string | undefined) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const ROLE_COMPANY_DEFAULTS: Partial<Record<UserRole, string>> = {
  client_lead: "CO-1001",
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
  // Identity is derived from the session (never copied into state in an effect);
  // only the role-switcher's choices are kept locally.
  const [override, setOverride] = useState<{ role?: UserRole; companyId?: string | null }>({});

  const base = useMemo(
    () => (status === "loading" ? initialUser : sessionToAuthUser(session)),
    [session, status, initialUser],
  );

  const user = useMemo<AuthUser>(() => {
    const role = override.role ?? base.role;
    const companyId =
      override.companyId !== undefined
        ? (override.companyId ?? undefined)
        : role === "client_lead"
          ? (base.companyId ?? ROLE_COMPANY_DEFAULTS.client_lead)
          : undefined;
    if (role === base.role && companyId === base.companyId) return base;
    return { ...base, role, companyId };
  }, [base, override]);

  const setRole = useCallback((role: UserRole) => {
    setOverride((current) => ({
      role,
      companyId: role === "client_lead" ? current.companyId : undefined,
    }));
  }, []);

  const setCompanyId = useCallback((companyId: string | undefined) => {
    setOverride((current) => ({ ...current, companyId: companyId ?? null }));
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
