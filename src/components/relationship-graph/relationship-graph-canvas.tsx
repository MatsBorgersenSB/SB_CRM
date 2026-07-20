"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CompanyRelationshipGraph, GraphNode } from "@/types/relationship-graph";
import { GRAPH_NODE_COLORS } from "@/types/relationship-graph";
import { RelationshipGraphNodeTooltip } from "@/components/relationship-graph/relationship-graph-node-tooltip";

type RelationshipGraphCanvasProps = {
  graph: CompanyRelationshipGraph;
};

function edgeStrokeWidth(strength: number): number {
  return 1 + (strength / 100) * 4;
}

function edgeOpacity(strength: number): number {
  return 0.15 + (strength / 100) * 0.55;
}

export function RelationshipGraphCanvas({ graph }: RelationshipGraphCanvasProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const nodeMap = useMemo(() => {
    const map = new Map<string, GraphNode>();
    for (const node of graph.nodes) map.set(node.id, node);
    return map;
  }, [graph.nodes]);

  const hoveredNode = hoveredId ? nodeMap.get(hoveredId) : null;

  const connectedIds = useMemo(() => {
    if (!hoveredId) return new Set<string>();
    const ids = new Set<string>([hoveredId]);
    for (const edge of graph.edges) {
      if (edge.sourceId === hoveredId) ids.add(edge.targetId);
      if (edge.targetId === hoveredId) ids.add(edge.sourceId);
    }
    return ids;
  }, [graph.edges, hoveredId]);

  return (
    <div className="relative">
      <svg
        viewBox="0 0 800 560"
        className="h-auto w-full"
        role="img"
        aria-label={`Relationship graph for ${graph.companyName}`}
      >
        <defs>
          <radialGradient id="graph-bg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(232,93,4,0.04)" />
            <stop offset="100%" stopColor="rgba(30,58,95,0.02)" />
          </radialGradient>
        </defs>
        <rect width="800" height="560" fill="url(#graph-bg)" />

        {[95, 155, 200, 235, 260].map((r) => (
          <circle
            key={r}
            cx={400}
            cy={280}
            r={r}
            fill="none"
            stroke="rgba(30,58,95,0.06)"
            strokeDasharray="4 6"
          />
        ))}

        {graph.edges.map((edge) => {
          const source = nodeMap.get(edge.sourceId);
          const target = nodeMap.get(edge.targetId);
          if (!source || !target) return null;

          const dimmed =
            hoveredId !== null &&
            !connectedIds.has(edge.sourceId) &&
            !connectedIds.has(edge.targetId);

          return (
            <line
              key={edge.id}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke={GRAPH_NODE_COLORS[source.kind === "company" ? target.kind : source.kind]}
              strokeWidth={edgeStrokeWidth(edge.strength)}
              strokeOpacity={dimmed ? 0.06 : edgeOpacity(edge.strength)}
            />
          );
        })}

        {graph.nodes.map((node) => {
          const isHovered = hoveredId === node.id;
          const isConnected = connectedIds.has(node.id);
          const dimmed = hoveredId !== null && !isConnected;
          const fill = GRAPH_NODE_COLORS[node.kind];

          return (
            <g
              key={node.id}
              transform={`translate(${node.x}, ${node.y})`}
              onMouseEnter={() => setHoveredId(node.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{ cursor: node.href ? "pointer" : "default", opacity: dimmed ? 0.25 : 1 }}
            >
              {node.kind === "company" ? (
                <circle
                  r={node.size}
                  fill={fill}
                  fillOpacity={0.15}
                  stroke={fill}
                  strokeWidth={isHovered ? 3 : 2}
                />
              ) : (
                <circle
                  r={node.size / 2}
                  fill={fill}
                  fillOpacity={isHovered ? 1 : 0.85}
                  stroke="white"
                  strokeWidth={isHovered ? 2 : 1}
                />
              )}
              {(isHovered || node.kind === "company") && (
                <text
                  y={node.size / 2 + 14}
                  textAnchor="middle"
                  className="fill-carbon-blue text-[9px] font-semibold"
                  style={{ fontSize: node.kind === "company" ? 11 : 9 }}
                >
                  {node.label.length > 22 ? `${node.label.slice(0, 20)}…` : node.label}
                </text>
              )}
              {node.riskLevel === "critical" || node.riskLevel === "high" ? (
                <circle r={node.size / 2 + 4} fill="none" stroke="#DC2626" strokeWidth={1.5} strokeDasharray="3 2" />
              ) : null}
            </g>
          );
        })}
      </svg>

      {hoveredNode ? (
        <RelationshipGraphNodeTooltip node={hoveredNode} graph={graph} />
      ) : null}

      <div className="mt-3 flex flex-wrap gap-3 px-1">
        {(
          [
            ["company", "Company"],
            ["contact", "Contacts"],
            ["opportunity", "Opportunities"],
            ["activity", "Activities"],
            ["document", "Documents"],
            ["material", "Materials"],
          ] as const
        ).map(([kind, label]) => (
          <span key={kind} className="inline-flex items-center gap-1.5 text-[10px] text-carbon-blue/50">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: GRAPH_NODE_COLORS[kind] }}
            />
            {label}
          </span>
        ))}
        <span className="text-[10px] text-carbon-blue/35">· Edge thickness = relationship strength</span>
      </div>
    </div>
  );
}

export function RelationshipGraphNodeLink({ node }: { node: GraphNode }) {
  if (!node.href) return null;
  return (
    <Link
      href={node.href}
      className="mt-2 inline-block text-[10px] font-semibold text-upcycle-orange hover:underline"
    >
      Open {node.kind} →
    </Link>
  );
}
