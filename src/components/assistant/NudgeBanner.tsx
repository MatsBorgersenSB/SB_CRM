"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ImpactContext } from "@/components/ui/impact-context";
import type { Nudge, NudgeSeverity } from "@/lib/assistant/nudge-engine";
import { company360Href } from "@/types/company-360";

const SEVERITY_STYLES: Record<NudgeSeverity, string> = {
  high: "border-thermal-red/30 bg-thermal-red/5 text-thermal-red",
  medium: "border-upcycle-orange/30 bg-upcycle-orange/5 text-upcycle-orange",
  low: "border-carbon-blue/20 bg-carbon-blue/[0.03] text-carbon-blue/70",
};

const SEVERITY_LABEL: Record<NudgeSeverity, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

type NudgeBannerProps = {
  /** When set, load nudges for this company. Omit for portfolio overview. */
  companyId?: string;
  companyName?: string;
  /** Cap how many nudges are shown. */
  maxItems?: number;
  className?: string;
};

export function NudgeBanner({
  companyId,
  companyName,
  maxItems = 4,
  className = "",
}: NudgeBannerProps) {
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = companyId
        ? `companyId=${encodeURIComponent(companyId)}`
        : "limit=8";
      const response = await fetch(`/api/assistant/nudges?${query}`);
      const body = (await response.json()) as {
        nudges?: Nudge[];
        error?: string;
      };
      if (!response.ok) {
        setNudges([]);
        return;
      }
      setNudges(body.nudges ?? []);
    } catch {
      setNudges([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = nudges
    .filter((nudge) => !dismissed.has(nudge.id))
    .slice(0, maxItems);

  if (loading || visible.length === 0) {
    return null;
  }

  return (
    <section
      className={`border border-carbon-blue/10 bg-[var(--dashboard-surface)] ${className}`}
      aria-label="Proactive nudges"
    >
      <div className="flex items-center justify-between border-b border-carbon-blue/8 px-4 py-2.5">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            What deserves attention
          </p>
          <p className="text-[12px] font-semibold text-carbon-blue">
            {companyName
              ? `Nudges for ${companyName}`
              : `${visible.length} account nudge${visible.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45 hover:text-upcycle-orange"
        >
          Refresh
        </button>
      </div>

      <ul className="divide-y divide-carbon-blue/8">
        {visible.map((nudge) => (
          <li key={nudge.id} className="px-4 py-3">
            <div className="flex flex-wrap items-start gap-2">
              <span
                className={`shrink-0 border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${SEVERITY_STYLES[nudge.severity]}`}
              >
                {SEVERITY_LABEL[nudge.severity]}
              </span>
              {!companyId ? (
                <Link
                  href={company360Href(nudge.companyId)}
                  className="text-[11px] font-semibold text-carbon-blue/55 hover:text-upcycle-orange"
                >
                  {nudge.companyName}
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() =>
                  setDismissed((current) => new Set(current).add(nudge.id))
                }
                className="ml-auto text-[10px] font-medium text-carbon-blue/35 hover:text-carbon-blue/60"
                aria-label="Dismiss nudge"
              >
                Dismiss
              </button>
            </div>

            <p className="mt-1.5 text-[13px] font-semibold leading-snug text-carbon-blue">
              {nudge.title}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-carbon-blue/60">
              {nudge.message}
            </p>

            <ImpactContext items={nudge.impact} />

            {nudge.actions.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {nudge.actions.slice(0, 3).map((action) =>
                  action.href ? (
                    <a
                      key={action.id}
                      href={action.href}
                      target={
                        action.kind === "draft_email" ? "_blank" : undefined
                      }
                      rel={
                        action.kind === "draft_email"
                          ? "noopener noreferrer"
                          : undefined
                      }
                      className={
                        action.kind === "draft_email" ||
                        action.kind === "add_economic_buyer"
                          ? "border border-upcycle-orange/30 bg-upcycle-orange/10 px-2.5 py-1 text-[11px] font-semibold text-upcycle-orange hover:bg-upcycle-orange/15"
                          : "border border-carbon-blue/15 bg-carbon-blue/[0.03] px-2.5 py-1 text-[11px] font-semibold text-carbon-blue/75 hover:border-carbon-blue/25"
                      }
                    >
                      {action.label}
                    </a>
                  ) : (
                    <span
                      key={action.id}
                      className="border border-carbon-blue/10 px-2.5 py-1 text-[11px] text-carbon-blue/45"
                    >
                      {action.label}
                    </span>
                  ),
                )}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
