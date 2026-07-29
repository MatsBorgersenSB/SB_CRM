"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/context/auth-context";
import { SmartAssistProvider } from "@/context/smart-assist-context";
import { SignalExtractProvider } from "@/context/signal-extract-context";
import { WorkspaceArchitectProvider } from "@/context/workspace-architect-context";
import { UniversalSearchProvider } from "@/components/search/universal-search-provider";

export function RootProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <SmartAssistProvider>
        <SignalExtractProvider>
          <WorkspaceArchitectProvider>
            <UniversalSearchProvider>{children}</UniversalSearchProvider>
          </WorkspaceArchitectProvider>
        </SignalExtractProvider>
      </SmartAssistProvider>
    </AuthProvider>
  );
}
