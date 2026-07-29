"use client";

import type { CompanyType } from "@/types/company-type";
import { getCompanyTypeMeta } from "@/types/company-type";

export function CompanyTypeBadges({
  types,
  size = "md",
}: {
  types: CompanyType[];
  size?: "sm" | "md";
}) {
  if (types.length === 0) return null;

  const textClass = size === "sm" ? "text-[10px]" : "text-[12px]";
  const padClass = size === "sm" ? "px-2 py-0.5" : "px-2.5 py-1";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {types.map((type) => {
        const meta = getCompanyTypeMeta(type);
        return (
          <span
            key={type}
            className={`inline-flex items-center gap-1 border border-carbon-blue/12 bg-carbon-blue/[0.03] ${padClass} ${textClass} font-medium text-carbon-blue`}
            title={`Company Type: ${meta.label}`}
          >
            <span aria-hidden>{meta.emoji}</span>
            {meta.label}
          </span>
        );
      })}
    </div>
  );
}
