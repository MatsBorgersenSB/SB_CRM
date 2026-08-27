import { Suspense } from "react";
import { DuplicateManagerShell } from "@/components/administration/duplicate-manager-shell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function DuplicateManagerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-carbon-blue/45">
          Loading Duplicate Manager…
        </div>
      }
    >
      <DuplicateManagerShell />
    </Suspense>
  );
}
