"use client";

import type { SmartAssistInsightCatalog } from "@/types/smartassist-intelligence";
import { INSIGHT_CATEGORY_LABELS } from "@/types/smartassist-intelligence";
import { SmartAssistInsightRow } from "@/components/smartassist/smartassist-intelligence-display";
import {
  EDITORIAL_BODY_MUTED,
  EDITORIAL_EMPTY,
  EDITORIAL_LABEL,
} from "@/lib/editorial-design-system";

const CATALOG_SECTIONS: Array<{
  key: keyof SmartAssistInsightCatalog;
  label: keyof typeof INSIGHT_CATEGORY_LABELS;
}> = [
  { key: "known", label: "known" },
  { key: "assumed", label: "assumed" },
  { key: "unknown", label: "unknown" },
  { key: "missingCritical", label: "missing_critical" },
];

export function ProjectInsightCatalogPanel({
  catalog,
  compact = false,
}: {
  catalog: SmartAssistInsightCatalog;
  compact?: boolean;
}) {
  return (
    <section aria-label="Project knowledge catalog" className="flex flex-col gap-6">
      <p className={`${EDITORIAL_BODY_MUTED} text-[13px]`}>
        SmartAssist is explicit about what it knows, what it assumes, what remains unknown, and
        what critical information is missing. Understanding is built through conversation and
        evidence — not assumptions.
      </p>

      <div className={`grid gap-4 ${compact ? "grid-cols-1" : "md:grid-cols-2"}`}>
        {CATALOG_SECTIONS.map((section) => {
          const items = catalog[section.key];
          return (
            <div
              key={section.key}
              className="border border-carbon-blue/10 bg-carbon-blue/[0.02] px-3 py-3"
            >
              <p className={EDITORIAL_LABEL}>{INSIGHT_CATEGORY_LABELS[section.label]}</p>
              {items.length === 0 ? (
                <p className={`mt-2 ${EDITORIAL_EMPTY} text-[12px]`}>None yet</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {items.slice(0, compact ? 3 : 6).map((insight) => (
                    <SmartAssistInsightRow key={insight.id} insight={insight} />
                  ))}
                </ul>
              )}
              {compact && items.length > 3 ? (
                <p className="mt-2 text-[11px] text-carbon-blue/45">
                  +{items.length - 3} more in full view
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
