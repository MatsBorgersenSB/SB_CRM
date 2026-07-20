import type { CompanyRelationshipGraph, GraphNode } from "@/types/relationship-graph";
import { RelationshipGraphNodeLink } from "@/components/relationship-graph/relationship-graph-canvas";

export function RelationshipGraphNodeTooltip({
  node,
  graph,
}: {
  node: GraphNode;
  graph: CompanyRelationshipGraph;
}) {
  const connections = graph.edges.filter(
    (e) => e.sourceId === node.id || e.targetId === node.id,
  ).length;

  return (
    <div className="pointer-events-none absolute right-2 top-2 z-10 w-56 border border-carbon-blue/10 bg-[var(--dashboard-card)] p-3 shadow-lg">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
        {node.kind}
      </p>
      <p className="mt-1 text-sm font-semibold text-carbon-blue">{node.label}</p>
      {node.subtitle ? (
        <p className="mt-0.5 text-[10px] text-carbon-blue/45">{node.subtitle}</p>
      ) : null}

      <dl className="mt-3 space-y-1.5 text-[10px]">
        {node.healthScore !== undefined ? (
          <div className="flex justify-between gap-2">
            <dt className="text-carbon-blue/40">Health</dt>
            <dd className="font-semibold tabular-nums text-carbon-blue">
              {node.healthScore}
              {node.healthLabel ? ` · ${node.healthLabel}` : ""}
            </dd>
          </div>
        ) : node.healthLabel ? (
          <div className="flex justify-between gap-2">
            <dt className="text-carbon-blue/40">Status</dt>
            <dd className="font-medium text-carbon-blue/70">{node.healthLabel}</dd>
          </div>
        ) : null}
        {node.riskLevel !== "none" ? (
          <div className="flex justify-between gap-2">
            <dt className="text-carbon-blue/40">Risk</dt>
            <dd className="font-semibold capitalize text-red-600">{node.riskLevel}</dd>
          </div>
        ) : null}
        {node.impact ? (
          <div className="flex justify-between gap-2">
            <dt className="text-carbon-blue/40">Impact</dt>
            <dd className="text-right font-medium text-carbon-blue/70">{node.impact}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-2">
          <dt className="text-carbon-blue/40">Dependencies</dt>
          <dd className="font-semibold tabular-nums text-carbon-blue">{connections}</dd>
        </div>
      </dl>

      <div className="pointer-events-auto">
        <RelationshipGraphNodeLink node={node} />
      </div>
    </div>
  );
}
