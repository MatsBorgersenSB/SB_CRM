"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AuthUser, UserRole } from "@/types/auth";
import { DEFAULT_AUTH_USER } from "@/types/auth";

type AuthContextValue = {
  user: AuthUser;
  setRole: (role: UserRole) => void;
  setCompanyId: (companyId: string | undefined) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const ROLE_COMPANY_DEFAULTS: Partial<Record<UserRole, string>> = {
  client_lead: "CO-1001",
};

export function AuthProvider({
  children,
  initialUser = DEFAULT_AUTH_USER,
}: {
  children: ReactNode;
  initialUser?: AuthUser;
}) {
  const [user, setUser] = useState<AuthUser>(initialUser);

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
