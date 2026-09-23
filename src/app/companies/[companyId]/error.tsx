"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Company360Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[SmartCRM /companies]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-semibold tracking-tight text-foreground">
        This company page could not load
      </p>
      <p className="mt-2 max-w-md text-xs leading-relaxed text-muted-foreground">
        The relationship record is still there. Reload, or go back to Companies
        and open it again.
      </p>
      <div className="mt-5 flex items-center gap-2">
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
        >
          Reload
        </button>
        <Link
          href="/companies"
          className="inline-flex h-9 items-center rounded-md border border-border/60 px-3 text-sm font-medium text-foreground"
        >
          Back to Companies
        </Link>
      </div>
    </div>
  );
}
