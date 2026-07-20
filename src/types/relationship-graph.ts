export type GraphEntityKind =
  | "company"
  | "contact"
  | "opportunity"
  | "activity"
  | "document"
  | "material";

export type GraphRiskType =
  | "single_contact"
  | "missing_stakeholders"
  | "missing_documents"
  | "weak_coverage"
  | "relationship_gap"
  | "knowledge_risk";

export type GraphNodeRiskLevel = "none" | "low" | "medium" | "high" | "critical";

export type GraphNode = {
  id: string;
  kind: GraphEntityKind;
  label: string;
  subtitle?: string;
  href?: string;
  ring: number;
  angle: number;
  radius: number;
  x: number;
  y: number;
  healthScore?: number;
  healthLabel?: string;
  riskLevel: GraphNodeRiskLevel;
  impact?: string;
  dependencyCount: number;
  size: number;
};

export type GraphEdgeKind = "ownership" | "activity" | "dependency" | "reference" | "material";

export type GraphEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  kind: GraphEdgeKind;
  strength: number;
  label?: string;
};

export type GraphInsight = {
  id: string;
  type: GraphRiskType;
  label: string;
  detail: string;
  severity: "critical" | "warning" | "info";
};

export type GraphDependency = {
  id: string;
  fromLabel: string;
  toLabel: string;
  kind: GraphEdgeKind;
  strength: number;
};

export type CompanyRelationshipGraph = {
  companyId: string;
  companyName: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  dependencies: GraphDependency[];
  insights: GraphInsight[];
  summary: string;
  stats: {
    contactCount: number;
    opportunityCount: number;
    activityCount: number;
    documentCount: number;
    materialCount: number;
    edgeCount: number;
    avgEdgeStrength: number;
  };
};

export const GRAPH_NODE_COLORS: Record<GraphEntityKind, string> = {
  company: "#E85D04",
  contact: "#3B82F6",
  opportunity: "#8B5CF6",
  activity: "#64748B",
  document: "#0EA5E9",
  material: "#10B981",
};

export const GRAPH_RISK_STYLES: Record<GraphNodeRiskLevel, string> = {
  none: "ring-carbon-blue/15",
  low: "ring-sky-500/40",
  medium: "ring-upcycle-orange/50",
  high: "ring-red-500/50",
  critical: "ring-red-600 animate-pulse",
};
