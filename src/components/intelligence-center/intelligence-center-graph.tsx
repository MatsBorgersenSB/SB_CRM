import Link from "next/link";
import type { RelationshipGraphIntelligenceSnapshot } from "@/lib/relationship-graph-intelligence-data";
import { IntelligenceCenterSection } from "@/components/intelligence-center/intelligence-center-section";

function GraphRankRow({ item }: { item: RelationshipGraphIntelligenceSnapshot["mostConnectedCompanies"][number] }) {
  return (
    <Link
      href={item.href}
      className="group flex items-center justify-between gap-3 border-b border-carbon-blue/6 px-4 py-3.5 last:border-b-0 hover:bg-carbon-blue/[0.02]"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-carbon-blue group-hover:text-upcycle-orange">
          {item.label}
        </p>
        <p className="mt-0.5 text-[10px] text-carbon-blue/45">{item.subtitle}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-lg font-bold tabular-nums text-carbon-blue">{item.metric}</p>
        <p className="text-[9px] uppercase tracking-wider text-carbon-blue/35">{item.metricLabel}</p>
      </div>
    </Link>
  );
}

export function IntelligenceCenterGraph({
  graphIntel,
}: {
  graphIntel: RelationshipGraphIntelligenceSnapshot;
}) {
  const { overview } = graphIntel;
  const topConnected = graphIntel.mostConnectedCompanies[0];
  const topCritical = graphIntel.mostCriticalDocuments[0];
  const gapCount = overview.companiesWithGaps;

  return (
    <div className="space-y-6">
      <section className="dashboard-card px-6 py-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-carbon-blue/40">
          Relationship graph
        </p>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-[11px] text-carbon-blue/45">Who matters</dt>
            <dd className="mt-1 text-sm font-medium text-carbon-blue">
              {topConnected?.label ?? "No hub companies identified yet"}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-carbon-blue/45">What is connected</dt>
            <dd className="mt-1 text-sm font-medium text-carbon-blue">
              {overview.totalConnections} edges across {overview.totalNetworks} company networks
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-carbon-blue/45">Dependencies</dt>
            <dd className="mt-1 text-sm font-medium text-carbon-blue">
              {topCritical
                ? `${topCritical.label} is the most critical knowledge asset`
                : "No critical document dependencies mapped"}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-carbon-blue/45">At risk</dt>
            <dd
              className={`mt-1 text-sm font-medium ${
                gapCount > 0 ? "text-upcycle-orange" : "text-carbon-blue"
              }`}
            >
              {gapCount > 0
                ? `${gapCount} network${gapCount === 1 ? "" : "s"} with relationship gaps`
                : "No structural gaps detected"}
            </dd>
          </div>
        </dl>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <IntelligenceCenterSection
          title="Most connected companies"
          description="Who matters — highest relationship density"
          count={graphIntel.mostConnectedCompanies.length}
          href="/companies"
          emptyMessage="No company networks yet."
          accent="default"
        >
          {graphIntel.mostConnectedCompanies.map((item) => (
            <GraphRankRow key={item.id} item={item} />
          ))}
        </IntelligenceCenterSection>

        <IntelligenceCenterSection
          title="Most critical documents"
          description="Knowledge dependencies at risk"
          count={graphIntel.mostCriticalDocuments.length}
          emptyMessage="No critical documents."
          accent="risk"
        >
          {graphIntel.mostCriticalDocuments.map((item) => (
            <GraphRankRow key={item.id} item={item} />
          ))}
        </IntelligenceCenterSection>
      </div>
    </div>
  );
}
