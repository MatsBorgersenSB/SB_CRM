/** Critical Path & Bottleneck Predictor types — safe for client components. */

export type BottleneckRiskLevel = "HIGH" | "MEDIUM";

export type CriticalPathBottleneck = {
  milestoneId: string;
  title: string;
  stage: string;
  vendorName: string | null;
  estimatedLeadDays: number | null;
  delayDays: number;
  riskLevel: BottleneckRiskLevel;
  mitigationSuggestion: string;
  targetDeliveryDate: string | null;
};

export type CriticalPathAnalysis = {
  projectId: string;
  projectTitle: string;
  totalLeadTimeDays: number;
  estimatedCodDelayDays: number;
  bottlenecks: CriticalPathBottleneck[];
  criticalMilestoneCount: number;
  onTrack: boolean;
};
