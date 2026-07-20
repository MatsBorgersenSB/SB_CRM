"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import type { OpportunityCriticalRisk } from "@/lib/opportunity-overview-engine";
import { ImpactContext } from "@/components/ui/impact-context";

const SEVERITY_LABELS = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
} as const;

export function OpportunityCriticalRisks({ risks }: { risks: OpportunityCriticalRisk[] }) {
  if (risks.length === 0) {
    return (
      <p className="text-[11px] text-carbon-blue/45">
        No critical risks flagged — continue executing recommended actions.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {risks.map((risk) => {
        const content = (
          <>
            <div className="flex items-start gap-2">
              <AlertTriangle
                className={`mt-0.5 size-3.5 shrink-0 ${
                  risk.severity === "critical"
                    ? "text-red-600"
                    : risk.severity === "high"
                      ? "text-amber-600"
                      : "text-carbon-blue/40"
                }`}
                strokeWidth={2}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-[11px] font-semibold text-carbon-blue">{risk.label}</p>
                  <span className="shrink-0 text-[8px] font-bold uppercase tracking-wider text-carbon-blue/35">
                    {SEVERITY_LABELS[risk.severity]}
                  </span>
                </div>
                {risk.detail ? (
                  <p className="mt-0.5 text-[10px] text-carbon-blue/55">{risk.detail}</p>
                ) : null}
                {risk.impact.length > 0 ? (
                  <div className="mt-1.5">
                    <ImpactContext items={risk.impact} label="Impact" />
                  </div>
                ) : null}
              </div>
            </div>
          </>
        );

        return (
          <li key={risk.id}>
            {risk.href ? (
              <Link
                href={risk.href}
                className="block rounded-lg border border-carbon-blue/10 px-3 py-2.5 transition-colors hover:border-upcycle-orange/25 hover:bg-upcycle-orange/[0.02]"
              >
                {content}
              </Link>
            ) : (
              <div className="rounded-lg border border-carbon-blue/10 px-3 py-2.5">
                {content}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
