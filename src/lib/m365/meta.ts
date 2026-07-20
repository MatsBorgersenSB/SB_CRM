import type { M365IntelligenceMeta } from "@/types/m365";

export function buildM365Meta(input: {
  whatMatters: string;
  whatIsAtRisk: string;
  whyItMatters: string | string[];
  whatShouldHappenNext: string;
  generatedAt?: string;
}): M365IntelligenceMeta {
  const why = Array.isArray(input.whyItMatters)
    ? input.whyItMatters.filter(Boolean).join(" · ")
    : input.whyItMatters;

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    whatMatters: input.whatMatters,
    whatIsAtRisk: input.whatIsAtRisk,
    whyItMatters: why,
    whatShouldHappenNext: input.whatShouldHappenNext,
  };
}

export function ensureImpact(impact: string[], fallback: string): string[] {
  const lines = impact.map((line) => line.trim()).filter(Boolean);
  return lines.length > 0 ? lines.slice(0, 3) : [fallback];
}
