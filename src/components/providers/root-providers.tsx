"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SessionProvider } from "next-auth/react";
import { AuthProvider } from "@/context/auth-context";
import { ThemeProvider } from "@/context/theme-context";
import { SmartAssistProvider } from "@/context/smart-assist-context";
import { UniversalSearchProvider } from "@/components/search/universal-search-provider";

function isLiteShellPath(pathname: string | null | undefined): boolean {
  if (pathname) {
    return (
      pathname.startsWith("/auth/") ||
      pathname.startsWith("/outlook-addin") ||
      pathname.startsWith("/outlook/")
    );
  }
  // Pathname can be briefly null during client transitions — fall back to location
  // so Outlook never mounts SessionProvider (HTML session responses → SyntaxError).
  if (typeof window !== "undefined") {
    const path = window.location.pathname;
    return (
      path.startsWith("/auth/") ||
      path.startsWith("/outlook-addin") ||
      path.startsWith("/outlook/")
    );
  }
  return false;
}

export function RootProviders({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // Outlook task panes / dialogs + auth: no SessionProvider, SmartAssist, or search index.
  // Auth is owned by OutlookAuthGate + dialog-bridge instead.
  if (isLiteShellPath(pathname)) {
    return <ThemeProvider>{children}</ThemeProvider>;
  }

  return (
    <ThemeProvider>
      <SessionProvider
        basePath="/api/auth"
        refetchOnWindowFocus={false}
        refetchInterval={0}
      >
        <AuthProvider>
          <SmartAssistProvider>
            <UniversalSearchProvider>{children}</UniversalSearchProvider>
          </SmartAssistProvider>
        </AuthProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
