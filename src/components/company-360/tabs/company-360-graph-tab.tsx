import type { CompanyRelationshipGraph } from "@/types/relationship-graph";
import { RelationshipGraphCanvas } from "@/components/relationship-graph/relationship-graph-canvas";
import { RelationshipGraphInsightsPanel } from "@/components/relationship-graph/relationship-graph-insights-panel";
import { CollapsibleSection } from "@/components/ui/collapsible-section";

function GraphInsightSummary({
  graph,
  compact = false,
}: {
  graph: CompanyRelationshipGraph;
  compact?: boolean;
}) {
  const topContact = [...graph.nodes]
    .filter((n) => n.kind === "contact")
    .sort((a, b) => b.dependencyCount - a.dependencyCount)[0];
  const atRisk =
    graph.insights.filter((i) => i.severity === "critical").length +
    graph.dependencies.filter((d) => d.strength < 40).length;

  if (compact) {
    return (
      <p className="text-[11px] leading-relaxed text-carbon-blue/55">
        <span className="font-medium text-carbon-blue">
          {topContact?.label ?? `${graph.stats.contactCount} contacts`}
        </span>
        {" · "}
        {graph.stats.edgeCount} connections
        {atRisk > 0 ? (
          <span className="text-upcycle-orange"> · {atRisk} at risk</span>
        ) : null}
      </p>
    );
  }

  return (
    <section className="dashboard-card px-6 py-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-carbon-blue/40">
        Graph insight
      </p>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-[11px] text-carbon-blue/45">Who matters</dt>
          <dd className="mt-1 text-sm font-medium text-carbon-blue">
            {topContact?.label ?? `${graph.stats.contactCount} contacts in network`}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] text-carbon-blue/45">What is connected</dt>
          <dd className="mt-1 text-sm font-medium text-carbon-blue">
            {graph.stats.edgeCount} connections across {graph.stats.contactCount} contacts,{" "}
            {graph.stats.opportunityCount} opportunities, {graph.stats.documentCount} documents
          </dd>
        </div>
      </dl>
    </section>
  );
}

export function Company360GraphTab({
  graph,
  embedded = false,
}: {
  graph: CompanyRelationshipGraph;
  embedded?: boolean;
}) {
  if (embedded) {
    return (
      <div className="flex flex-col gap-4">
        <GraphInsightSummary graph={graph} compact />
        <RelationshipGraphCanvas graph={graph} />
        {graph.insights.length > 0 ? (
          <CollapsibleSection title="Network insights" tier="expert">
            <RelationshipGraphInsightsPanel insights={graph.insights} />
          </CollapsibleSection>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <GraphInsightSummary graph={graph} />

      <div className="grid gap-8 xl:grid-cols-3">
        <section className="dashboard-card xl:col-span-2">
          <header className="border-b border-carbon-blue/8 px-6 py-5">
            <h2 className="text-sm font-semibold text-carbon-blue">Relationship network</h2>
            <p className="mt-1 text-[11px] text-carbon-blue/45">{graph.summary}</p>
          </header>
          <div className="px-4 py-6 sm:px-6">
            <RelationshipGraphCanvas graph={graph} />
          </div>
        </section>

        <div className="space-y-6">
          <RelationshipGraphInsightsPanel insights={graph.insights} />

          {graph.dependencies.length > 0 ? (
            <section className="dashboard-card">
              <header className="border-b border-carbon-blue/8 px-6 py-4">
                <h2 className="text-sm font-semibold text-carbon-blue">Key dependencies</h2>
              </header>
              <ul className="divide-y divide-carbon-blue/6">
                {graph.dependencies.slice(0, 5).map((dep) => (
                  <li key={dep.id} className="px-6 py-3.5">
                    <p className="text-[11px] text-carbon-blue/70">
                      <span className="font-medium text-carbon-blue">{dep.fromLabel}</span>
                      <span className="text-carbon-blue/30"> → </span>
                      <span className="font-medium text-carbon-blue">{dep.toLabel}</span>
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
