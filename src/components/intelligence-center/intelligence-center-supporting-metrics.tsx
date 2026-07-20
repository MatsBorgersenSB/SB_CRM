import Link from "next/link";
import type { IntelligenceCenterOverview } from "@/lib/intelligence-center-data";
import type { SmartDocsIntelligenceSnapshot } from "@/lib/smartdocs-intelligence-data";

export function IntelligenceCenterSupportingMetrics({
  overview,
  smartDocs,
  bare = false,
}: {
  overview: IntelligenceCenterOverview;
  smartDocs: SmartDocsIntelligenceSnapshot;
  bare?: boolean;
}) {
  const metrics = [
    { label: "Portfolio health", value: overview.averageHealthScore },
    { label: "Strategic accounts", value: overview.strategicCount },
    { label: "Improving", value: overview.improvingCount },
    { label: "Declining", value: overview.decliningCount },
    { label: "Total companies", value: overview.totalCompanies },
    { label: "Documents tracked", value: smartDocs.overview.totalDocuments },
  ];

  const grid = (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
      {metrics.map((metric) => (
        <div key={metric.label}>
          <dt className="text-[9px] uppercase tracking-wider text-carbon-blue/35">{metric.label}</dt>
          <dd className="mt-0.5 text-sm font-semibold tabular-nums text-carbon-blue/70">
            {metric.value}
          </dd>
        </div>
      ))}
    </dl>
  );

  if (bare) {
    return (
      <div>
        {grid}
        <p className="mt-4 text-[10px] text-carbon-blue/40">
          Detail in{" "}
          <Link href="/companies" className="hover:text-upcycle-orange">
            Companies
          </Link>
          {" · "}
          <Link href="/knowledge" className="hover:text-upcycle-orange">
            SmartDocs
          </Link>
        </p>
      </div>
    );
  }

  return (
    <section className="border border-carbon-blue/8 bg-carbon-blue/[0.015] px-6 py-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-carbon-blue/35">
        Supporting metrics
      </p>
      <div className="mt-4">{grid}</div>
      <p className="mt-4 text-[10px] text-carbon-blue/30">
        Strategic accounts and full document intelligence in{" "}
        <Link href="/companies" className="text-carbon-blue/50 hover:text-upcycle-orange">
          Companies
        </Link>
        {" · "}
        <Link href="/knowledge" className="text-carbon-blue/50 hover:text-upcycle-orange">
          SmartDocs
        </Link>
      </p>
    </section>
  );
}
