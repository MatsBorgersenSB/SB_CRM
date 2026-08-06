"use client";

import type { ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import { AuthProvider } from "@/context/auth-context";
import { SmartAssistProvider } from "@/context/smart-assist-context";
import { UniversalSearchProvider } from "@/components/search/universal-search-provider";

export function RootProviders({ children }: { children: ReactNode }) {
  return (
    <SessionProvider basePath="/api/auth" refetchOnWindowFocus={false}>
      <AuthProvider>
        <SmartAssistProvider>
          <UniversalSearchProvider>{children}</UniversalSearchProvider>
        </SmartAssistProvider>
      </AuthProvider>
    </SessionProvider>
  );
}
