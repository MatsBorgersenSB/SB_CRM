"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/** Progressive disclosure tiers — must-see → nice-to-have → expert */
export type DisclosureTier = "must-see" | "nice-to-have" | "expert";

type CollapsibleSectionProps = {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  tier?: DisclosureTier;
  children: ReactNode;
  className?: string;
};

const TIER_DEFAULT_OPEN: Record<DisclosureTier, boolean> = {
  "must-see": true,
  "nice-to-have": false,
  expert: false,
};

export function CollapsibleSection({
  title,
  description,
  defaultOpen,
  tier = "nice-to-have",
  children,
  className = "",
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen ?? TIER_DEFAULT_OPEN[tier]);

  const shellClass =
    tier === "expert"
      ? "border border-carbon-blue/8 bg-carbon-blue/[0.015]"
      : "dashboard-card overflow-hidden";

  return (
    <section className={`${shellClass} ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-carbon-blue/[0.02] sm:px-5 sm:py-4"
      >
        <div className="min-w-0">
          <p
            className={`text-sm font-semibold ${
              tier === "expert" ? "text-carbon-blue/65" : "text-carbon-blue"
            }`}
          >
            {title}
          </p>
          {description ? (
            <p className="mt-0.5 text-[11px] text-carbon-blue/45">{description}</p>
          ) : null}
        </div>
        <ChevronDown
          className={`mt-0.5 size-4 shrink-0 text-carbon-blue/35 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open ? (
        <div className="border-t border-carbon-blue/8 px-4 py-4 sm:px-5">{children}</div>
      ) : null}
    </section>
  );
}
