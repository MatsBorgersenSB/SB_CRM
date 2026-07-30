"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Prevents double-submit: locks on first call until the async work finishes.
 */
export function useFormSubmitLock() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const lockedRef = useRef(false);

  const runLocked = useCallback(async <T,>(work: () => Promise<T>): Promise<T | undefined> => {
    if (lockedRef.current) return undefined;
    lockedRef.current = true;
    setIsSubmitting(true);
    try {
      return await work();
    } finally {
      lockedRef.current = false;
      setIsSubmitting(false);
    }
  }, []);

  return { isSubmitting, runLocked };
}
