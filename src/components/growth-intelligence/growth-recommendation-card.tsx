import { ImpactContext } from "@/components/ui/impact-context";
import type { GrowthRecommendation } from "@/types/growth-intelligence";

export function GrowthRecommendationCard({
  recommendation,
}: {
  recommendation: GrowthRecommendation;
}) {
  return (
    <article className="dashboard-card p-4 sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-upcycle-orange">
            Recommendation · {recommendation.horizon}
          </p>
          <h3 className="mt-1 text-sm font-semibold text-carbon-blue">{recommendation.what}</h3>
        </div>
      </header>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        {(
          [
            ["Why", recommendation.why],
            ["When", recommendation.when],
            ["Where", recommendation.where],
            ["How", recommendation.how],
            ["Expected Outcome", recommendation.expectedOutcome],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-[9px] font-bold uppercase tracking-[0.1em] text-carbon-blue/35">
              {label}
            </dt>
            <dd className="mt-0.5 text-[11px] leading-relaxed text-carbon-blue/70">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {recommendation.outcomes.map((outcome) => (
          <span
            key={outcome}
            className="rounded-full border border-carbon-blue/10 px-2 py-0.5 text-[9px] font-medium text-carbon-blue/55"
          >
            {outcome}
          </span>
        ))}
      </div>
    </article>
  );
}

export function GrowthImpactBlock({
  label,
  items,
}: {
  label?: string;
  items: string[];
}) {
  if (items.length === 0) return null;
  return <ImpactContext label={label ?? "Strategic impact"} items={items} />;
}
