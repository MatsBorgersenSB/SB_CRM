import type { DeepResearchPriority } from "@/types/deep-research";

export type ResearchReportType =
  | "executive_briefing"
  | "opportunity_assessment"
  | "customer_deep_dive"
  | "competitor_deep_dive"
  | "market_intelligence"
  | "investment_intelligence";

export const RESEARCH_REPORT_TYPE_LABELS: Record<ResearchReportType, string> = {
  executive_briefing: "Executive Briefing",
  opportunity_assessment: "Opportunity Assessment",
  customer_deep_dive: "Customer Deep Dive",
  competitor_deep_dive: "Competitor Deep Dive",
  market_intelligence: "Market Intelligence Report",
  investment_intelligence: "Investment Intelligence Report",
};

export type ResearchReportSectionId =
  | "executive_summary"
  | "why_this_matters"
  | "findings"
  | "opportunities"
  | "risks"
  | "recommended_actions"
  | "strategic_assessment"
  | "sources";

export const RESEARCH_REPORT_SECTION_ORDER: ResearchReportSectionId[] = [
  "executive_summary",
  "why_this_matters",
  "findings",
  "opportunities",
  "risks",
  "recommended_actions",
  "strategic_assessment",
  "sources",
];

export const RESEARCH_REPORT_SECTION_LABELS: Record<ResearchReportSectionId, string> = {
  executive_summary: "Executive Summary",
  why_this_matters: "Why This Matters",
  findings: "Findings",
  opportunities: "Opportunities",
  risks: "Risks",
  recommended_actions: "Recommended Actions",
  strategic_assessment: "Strategic Assessment",
  sources: "Sources",
};

export type ResearchReportBullet = {
  label: string;
  detail?: string;
  href?: string;
};

export type ResearchReportSection = {
  id: ResearchReportSectionId;
  title: string;
  paragraphs: string[];
  bullets: ResearchReportBullet[];
};

export type ResearchReportMetadata = {
  companyId?: string;
  companyName?: string;
  dealId?: string;
  dealName?: string;
  contactId?: string;
  contactName?: string;
  generatedBy: string;
  sharePointPath: string;
  sharePointUrl: string;
};

export type ResearchReport = {
  id: string;
  reportId: string;
  type: ResearchReportType;
  typeLabel: string;
  title: string;
  subject: string;
  generatedAt: string;
  docCategory: "Operational" | "Commercial";
  docType: string;
  revision: string;
  priority: DeepResearchPriority;
  strategicPriority: string;
  sections: ResearchReportSection[];
  metadata: ResearchReportMetadata;
  sourceQuery?: string;
  briefingId?: string;
};

export type ResearchReportExportFormat = "docx" | "pdf" | "sharepoint";

export type StoredResearchReport = ResearchReport & {
  fileLeafRef: string;
  storedAt: string;
  searchableText: string;
};
