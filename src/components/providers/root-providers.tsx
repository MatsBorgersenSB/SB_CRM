"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SessionProvider } from "next-auth/react";
import { AuthProvider } from "@/context/auth-context";
import { SmartAssistProvider } from "@/context/smart-assist-context";
import { UniversalSearchProvider } from "@/components/search/universal-search-provider";

export function RootProviders({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAuthRoute = pathname?.startsWith("/auth/") ?? false;

  // Keep Microsoft sign-in free of next-auth/react client fetches
  // (those can throw SyntaxError when a response is HTML).
  if (isAuthRoute) {
    return <>{children}</>;
  }

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
