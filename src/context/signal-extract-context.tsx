"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { SignalExtractModal } from "@/components/assistant/SignalExtractModal";

export type SignalExtractContextValue = {
  openSignalExtract: (options?: {
    companyId?: string;
    companyName?: string;
    opportunityId?: string;
  }) => void;
  closeSignalExtract: () => void;
};

const SignalExtractContext = createContext<SignalExtractContextValue | null>(null);

export function SignalExtractProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [companyId, setCompanyId] = useState<string | undefined>();
  const [companyName, setCompanyName] = useState<string | undefined>();
  const [opportunityId, setOpportunityId] = useState<string | undefined>();

  const openSignalExtract = useCallback(
    (options?: { companyId?: string; companyName?: string; opportunityId?: string }) => {
      setCompanyId(options?.companyId);
      setCompanyName(options?.companyName);
      setOpportunityId(options?.opportunityId);
      setOpen(true);
    },
    [],
  );

  const closeSignalExtract = useCallback(() => {
    setOpen(false);
  }, []);

  const value = useMemo(
    () => ({ openSignalExtract, closeSignalExtract }),
    [openSignalExtract, closeSignalExtract],
  );

  return (
    <SignalExtractContext.Provider value={value}>
      {children}
      <SignalExtractModal
        open={open}
        onClose={closeSignalExtract}
        companyId={companyId}
        companyName={companyName}
        opportunityId={opportunityId}
      />
    </SignalExtractContext.Provider>
  );
}

export function useSignalExtract(): SignalExtractContextValue {
  const ctx = useContext(SignalExtractContext);
  if (!ctx) {
    throw new Error("useSignalExtract must be used within SignalExtractProvider");
  }
  return ctx;
}
