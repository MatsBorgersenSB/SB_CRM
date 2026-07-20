"use client";

import type { OpportunityMatterItem } from "@/lib/opportunity-overview-engine";

const SEVERITY_STYLES = {
  critical: "border-red-500/30 bg-red-500/[0.04] text-red-800",
  warning: "border-amber-500/30 bg-amber-500/[0.04] text-amber-900",
  info: "border-carbon-blue/10 bg-carbon-blue/[0.02] text-carbon-blue",
} as const;

export function OpportunityWhatMattersNow({ items }: { items: OpportunityMatterItem[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li
          key={item.id}
          className={`rounded-lg border px-3 py-2.5 ${SEVERITY_STYLES[item.severity]}`}
        >
          <p className="text-[11px] font-semibold leading-snug">{item.label}</p>
          {item.detail ? (
            <p className="mt-0.5 text-[10px] leading-relaxed opacity-75">{item.detail}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
