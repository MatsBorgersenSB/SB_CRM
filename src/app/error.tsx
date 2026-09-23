"use client";

import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[SmartCRM]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-semibold tracking-tight text-foreground">
        SmartCRM could not load this page
      </p>
      <p className="mt-2 max-w-md text-xs leading-relaxed text-muted-foreground">
        The records are still there. Reload to try again.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-5 inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
      >
        Reload
      </button>
    </div>
  );
}
