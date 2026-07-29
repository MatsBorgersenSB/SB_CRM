"use client";

import type { ICPScoreResult, ICPTier } from "@/lib/marketing/icp-matcher";
import {
  calculateICPScore,
  companyToICPInput,
  icpTierLabel,
} from "@/lib/marketing/icp-matcher";
import type { Company } from "@/types/company";

const TIER_STYLES: Record<ICPTier, string> = {
  TIER_1_ABM:
    "border-emerald-600/30 bg-emerald-50 text-emerald-800",
  TIER_2_WATCHLIST:
    "border-upcycle-orange/30 bg-upcycle-orange/10 text-upcycle-orange",
  TIER_3_DISQUALIFIED:
    "border-carbon-blue/20 bg-carbon-blue/[0.04] text-carbon-blue/65",
};

const TIER_ICON: Record<ICPTier, string> = {
  TIER_1_ABM: "🎯",
  TIER_2_WATCHLIST: "👀",
  TIER_3_DISQUALIFIED: "⚠️",
};

type ICPScoreBadgeProps = {
  /** Precomputed result — preferred for tables */
  result?: ICPScoreResult;
  /** Or pass company to score client-side */
  company?: Company & { size?: string | null; employeeCount?: number | null };
  size?: "sm" | "md";
  showPercent?: boolean;
  className?: string;
};

function buildTooltip(result: ICPScoreResult): string {
  const lines = [
    `ICP score ${result.score}/100 · ${icpTierLabel(result.tier)}`,
    `Geography ${result.breakdown.geography} · Sectors ${result.breakdown.sectors} · Fit ${result.breakdown.companyFit}`,
  ];
  if (result.matchingCriteria.length > 0) {
    lines.push("Matches:");
    for (const item of result.matchingCriteria.slice(0, 5)) {
      lines.push(`• ${item}`);
    }
  }
  if (result.gaps.length > 0) {
    lines.push("Gaps:");
    for (const item of result.gaps.slice(0, 4)) {
      lines.push(`• ${item}`);
    }
  }
  return lines.join("\n");
}

export function ICPScoreBadge({
  result: resultProp,
  company,
  size = "md",
  showPercent = true,
  className = "",
}: ICPScoreBadgeProps) {
  const result =
    resultProp ??
    (company
      ? calculateICPScore(companyToICPInput(company))
      : null);

  if (!result) return null;

  const label = icpTierLabel(result.tier);
  const text =
    size === "sm"
      ? `${TIER_ICON[result.tier]} ${label.replace(" Target", "").replace(" Watchlist", "")}${
          showPercent ? ` ${result.score}%` : ""
        }`
      : `${TIER_ICON[result.tier]} ${label}${
          showPercent ? ` (${result.score}%)` : ""
        }`;

  return (
    <span
      title={buildTooltip(result)}
      className={`inline-flex max-w-full items-center truncate border px-2 py-0.5 font-semibold ${
        size === "sm" ? "text-[10px]" : "text-[11px]"
      } ${TIER_STYLES[result.tier]} ${className}`}
    >
      {text}
    </span>
  );
}
