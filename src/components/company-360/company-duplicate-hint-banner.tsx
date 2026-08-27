"use client";

import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { canAccessDuplicateManager } from "@/lib/permissions";
import type { CompanyDuplicateHint } from "@/lib/duplicate-management/company-hint";

export function CompanyDuplicateHintBanner({
  hint,
}: {
  hint: CompanyDuplicateHint | null;
}) {
  const { user } = useAuth();
  if (!hint || !canAccessDuplicateManager(user.role)) return null;

  return (
    <section className="border border-upcycle-orange/30 bg-upcycle-orange/[0.04] px-4 py-3">
      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-upcycle-orange">
        Possible duplicate · {hint.confidence}
      </p>
      <p className="mt-1 text-sm font-medium text-carbon-blue">
        May be the same as {hint.otherNames.join(", ") || "another company"}
      </p>
      <p className="mt-0.5 text-[11px] text-carbon-blue/55">
        {hint.reasons.slice(0, 2).join(" · ")}
      </p>
      <Link
        href={hint.managerHref}
        className="mt-2 inline-flex border border-upcycle-orange bg-upcycle-orange px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white"
      >
        Review in Duplicate Manager
      </Link>
    </section>
  );
}
