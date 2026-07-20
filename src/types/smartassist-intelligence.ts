import type { ConfidenceLevel } from "@/lib/opportunity-workspace-intelligence";

/** Phase 1.2 — every SmartAssist insight is explicitly categorized. */
export type InsightCategory =
  | "known"
  | "assumed"
  | "unknown"
  | "missing_critical";

export const INSIGHT_CATEGORY_LABELS: Record<InsightCategory, string> = {
  known: "Known",
  assumed: "Assumed",
  unknown: "Unknown",
  missing_critical: "Missing Critical Information",
};

export type SmartAssistInsight = {
  id: string;
  statement: string;
  category: InsightCategory;
  confidence: ConfidenceLevel;
  confidenceReason?: string;
  topic?: string;
};

export type SmartAssistUnknownResponse = {
  statement: "I do not know";
  why: string;
  missingInformation: string[];
  askNext: string[];
};

export type SmartAssistQueryResponse = {
  headline: string;
  primaryCategory: InsightCategory;
  confidence: ConfidenceLevel;
  insights: SmartAssistInsight[];
  unknown?: SmartAssistUnknownResponse;
  sources: string[];
  suggestedQuestions: string[];
};

export type SmartAssistInsightCatalog = {
  known: SmartAssistInsight[];
  assumed: SmartAssistInsight[];
  unknown: SmartAssistInsight[];
  missingCritical: SmartAssistInsight[];
  all: SmartAssistInsight[];
};

export type SmartAssistAssessmentSummary = {
  headline: string;
  confidence: ConfidenceLevel;
  confidenceReason: string;
  nextAction: SmartAssistInsight;
  attentionInsight: SmartAssistInsight;
};
