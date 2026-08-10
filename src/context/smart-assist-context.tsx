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
import { usePathname } from "next/navigation";
import type { Activity } from "@/types/activity";
import type { CommercialPackage } from "@/types/commercial-package";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type { SmartAssistFocus } from "@/types/smart-assist";
import { buildSmartAssistFocus } from "@/lib/smart-assist-engine";
import { filterHandledCoPilotProposals, hydrateCoPilotDismissalsFromServer } from "@/lib/smartassist-copilot-store";
import { useAuth } from "@/context/auth-context";
import {
  filterCompaniesForUser,
  filterPipelinesForUser,
} from "@/lib/permissions";

type SmartAssistContextValue = {
  focus: SmartAssistFocus | null;
  loading: boolean;
  refresh: () => void;
  meta: {
    companies: Company[];
    pipelines: PipelineRow[];
    activities: Activity[];
    commercialPackages: CommercialPackage[];
  } | null;
  visible: boolean;
};

const SmartAssistContext = createContext<SmartAssistContextValue | null>(null);

/**
 * SmartAssist intelligence layer — no floating widget.
 * Intelligence is embedded natively in each workspace.
 */
export function SmartAssistProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [focus, setFocus] = useState<SmartAssistFocus | null>(null);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<SmartAssistContextValue["meta"]>(null);

  const visible = !pathname?.startsWith("/outlook");

  const loadFocus = useCallback(() => {
    if (!visible) return;
    setLoading(true);
    void (async () => {
      try {
        await hydrateCoPilotDismissalsFromServer(user.email);
        const response = await fetch("/api/smartassist/focus");
        const body = (await response.json()) as {
          focus: SmartAssistFocus;
          meta: NonNullable<SmartAssistContextValue["meta"]>;
        };
        const scopedCompanies = filterCompaniesForUser(body.meta.companies, user);
        const scopedPipelines = filterPipelinesForUser(
          body.meta.pipelines,
          user,
          body.meta.companies,
        );
        setMeta({
          ...body.meta,
          companies: scopedCompanies,
          pipelines: scopedPipelines,
        });
        const built = buildSmartAssistFocus(
          scopedCompanies,
          scopedPipelines,
          body.meta.activities,
          body.meta.commercialPackages,
          user,
        );
        const filteredProposals = filterHandledCoPilotProposals(built.copilotProposals);
        setFocus({
          ...built,
          copilotProposals: filteredProposals,
          metrics: {
            ...built.metrics,
            pendingCrmActions: filteredProposals.length,
          },
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [user, visible]);

  useEffect(() => {
    loadFocus();
  }, [loadFocus]);

  const value = useMemo(
    () => ({
      focus,
      loading,
      refresh: loadFocus,
      meta,
      visible,
    }),
    [focus, loading, loadFocus, meta, visible],
  );

  return <SmartAssistContext.Provider value={value}>{children}</SmartAssistContext.Provider>;
}

export function useSmartAssist(): SmartAssistContextValue {
  const context = useContext(SmartAssistContext);
  if (!context) {
    throw new Error("useSmartAssist must be used within SmartAssistProvider");
  }
  return context;
}
