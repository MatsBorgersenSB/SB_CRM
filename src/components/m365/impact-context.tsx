import type { M365IntelligenceMeta } from "@/types/m365";
import { ImpactContext as BaseImpactContext } from "@/components/ui/impact-context";

/** M365-facing impact block — required on every risk, action, and intelligence surface. */
export function ImpactContext({
  items,
  label = "Why this matters",
}: {
  items: string[];
  label?: string;
}) {
  const lines = items.map((item) => item.trim()).filter(Boolean);
  return <BaseImpactContext label={label} items={lines} />;
}

/** Compact meta strip answering the four intelligence questions. */
export function M365IntelligenceMetaStrip({ meta }: { meta: M365IntelligenceMeta }) {
  return (
    <div className="space-y-2 border-b border-carbon-blue/8 pb-4">
      <p className="text-sm font-semibold leading-snug text-carbon-blue">{meta.whatMatters}</p>
      <dl className="grid gap-2 text-[11px] sm:grid-cols-2">
        <div>
          <dt className="font-semibold uppercase tracking-[0.1em] text-carbon-blue/35">At risk</dt>
          <dd className="mt-0.5 text-carbon-blue/65">{meta.whatIsAtRisk}</dd>
        </div>
        <div>
          <dt className="font-semibold uppercase tracking-[0.1em] text-carbon-blue/35">
            Next step
          </dt>
          <dd className="mt-0.5 text-carbon-blue/65">{meta.whatShouldHappenNext}</dd>
        </div>
      </dl>
      {meta.whyItMatters ? (
        <p className="border-l-2 border-upcycle-orange/40 pl-3 text-[11px] leading-relaxed text-carbon-blue/55">
          {meta.whyItMatters}
        </p>
      ) : null}
    </div>
  );
}
