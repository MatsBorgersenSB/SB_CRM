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
import { WorkspaceArchitectBar } from "@/components/assistant/WorkspaceArchitectBar";

type WorkspaceArchitectContextValue = {
  openArchitect: () => void;
  closeArchitect: () => void;
  toggleArchitect: () => void;
};

const WorkspaceArchitectContext =
  createContext<WorkspaceArchitectContextValue | null>(null);

export function WorkspaceArchitectProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  const openArchitect = useCallback(() => setOpen(true), []);
  const closeArchitect = useCallback(() => setOpen(false), []);
  const toggleArchitect = useCallback(() => setOpen((value) => !value), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || !event.shiftKey) return;
      if (event.key.toLowerCase() !== "k") return;
      event.preventDefault();
      setOpen((value) => !value);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const value = useMemo(
    () => ({ openArchitect, closeArchitect, toggleArchitect }),
    [openArchitect, closeArchitect, toggleArchitect],
  );

  return (
    <WorkspaceArchitectContext.Provider value={value}>
      {children}
      <WorkspaceArchitectBar open={open} onClose={closeArchitect} />
    </WorkspaceArchitectContext.Provider>
  );
}

export function useWorkspaceArchitect(): WorkspaceArchitectContextValue {
  const ctx = useContext(WorkspaceArchitectContext);
  if (!ctx) {
    throw new Error(
      "useWorkspaceArchitect must be used within WorkspaceArchitectProvider",
    );
  }
  return ctx;
}
