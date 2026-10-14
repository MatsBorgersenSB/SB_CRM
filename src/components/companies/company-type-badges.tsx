"use client";

import type { CompanyType } from "@/types/company-type";
import { getCompanyTypeMeta } from "@/types/company-type";
import { CompanyTypeIcon } from "@/components/companies/company-type-icon";

/** Short single-line labels for list cells; full label stays in the tooltip. */
const SHORT_LABEL: Record<string, string> = {
  "Supplier / Vendor": "Supplier",
  "University / Research": "Research",
  "Public / Government": "Public",
  "NGO / Non-Profit": "NGO",
  "Granting Authority": "Grant body",
  "Service Provider": "Service",
  "Internal Company": "Internal",
};

export function CompanyTypeBadges({
  types,
  size = "md",
  compact = false,
}: {
  types: CompanyType[];
  size?: "sm" | "md";
  /** Short labels and quieter chrome for table cells. */
  compact?: boolean;
}) {
  if (types.length === 0) return null;

  const textClass = size === "sm" ? "text-[11px]" : "text-[12px]";
  const padClass = size === "sm" ? "px-1.5 py-0.5" : "px-2 py-1";
  const chrome = compact
    ? "text-carbon-blue/70"
    : "border border-carbon-blue/12 bg-carbon-blue/[0.03] text-carbon-blue";

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {types.map((type) => {
        const meta = getCompanyTypeMeta(type);
        const label = compact ? (SHORT_LABEL[meta.label] ?? meta.label) : meta.label;
        return (
          <span
            key={type}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap ${compact ? "" : padClass} ${textClass} font-medium ${chrome}`}
            title={`Relationship type: ${meta.label}`}
          >
            <CompanyTypeIcon icon={meta.icon} size={size === "sm" ? 12 : 13} className="opacity-70" />
            {label}
          </span>
        );
      })}
    </div>
  );
}
