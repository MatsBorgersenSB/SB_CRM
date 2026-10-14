"use client";

import { createContext, useContext } from "react";

export type UniversalSearchOpenOptions = {
  /** Start in Ask mode (SmartAssist) instead of Search. */
  mode?: "search" | "ask";
  /** Pre-filled text the user can edit before pressing Enter. */
  query?: string;
};

type UniversalSearchContextValue = {
  open: boolean;
  openSearch: (options?: UniversalSearchOpenOptions) => void;
  closeSearch: () => void;
  toggleSearch: () => void;
};

export const UniversalSearchContext = createContext<UniversalSearchContextValue | null>(
  null,
);

export function useUniversalSearch(): UniversalSearchContextValue {
  const ctx = useContext(UniversalSearchContext);
  if (!ctx) {
    throw new Error("useUniversalSearch must be used within UniversalSearchProvider");
  }
  return ctx;
}

/** Safe hook for optional search trigger (returns no-op if provider missing). */
export function useUniversalSearchOptional(): UniversalSearchContextValue | null {
  return useContext(UniversalSearchContext);
}
