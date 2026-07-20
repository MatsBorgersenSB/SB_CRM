"use client";

import { createContext, useContext } from "react";

type UniversalSearchContextValue = {
  open: boolean;
  openSearch: () => void;
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
