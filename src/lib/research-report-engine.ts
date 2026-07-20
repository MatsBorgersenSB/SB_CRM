import type { DeepResearchBriefing, DeepResearchKind } from "@/types/deep-research";
import type {
  ResearchReport,
  ResearchReportBullet,
  ResearchReportSection,
  ResearchReportSectionId,
  ResearchReportType,
} from "@/types/research-report";
import {
  RESEARCH_REPORT_SECTION_LABELS,
  RESEARCH_REPORT_SECTION_ORDER,
  RESEARCH_REPORT_TYPE_LABELS,
} from "@/types/research-report";

function reportTypeForBriefing(briefing: DeepResearchBriefing): ResearchReportType {
  const hasInvestmentSignals = briefing.recentNews.some(
    (item) =>
      /invest|fund|financ/i.test(item.label) || /invest|fund|financ/i.test(item.detail ?? ""),
  );

  if (hasInvestmentSignals && briefing.kind === "market") {
    return "investment_intelligence";
  }

  const map: Record<DeepResearchKind, ResearchReportType> = {
    company: "customer_deep_dive",
    contact: "executive_briefing",
    competitor: "competitor_deep_dive",
    market: "market_intelligence",
    project: "opportunity_assessment",
    technology: "market_intelligence",
  };

  return map[briefing.kind];
}

function docTypeForReport(type: ResearchReportType): string {
  return RESEARCH_REPORT_TYPE_LABELS[type];
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function nextReportId(existingCount: number): string {
  return `RR-${String(1000 + existingCount + 1)}`;
}

function buildFindings(briefing: DeepResearchBriefing): ResearchReportBullet[] {
  return [
    ...briefing.recentNews.map((item) => ({
      label: item.label,
      detail: item.detail,
      href: item.href,
    })),
    ...briefing.projectSignals.map((item) => ({
      label: item.label,
      detail: item.detail,
      href: item.href,
    })),
    ...briefing.knownRelationship.activities.slice(0, 3).map((item) => ({
      label: `Activity: ${item.label}`,
      detail: item.detail,
      href: item.href,
    })),
  ];
}

function buildOpportunityBullets(briefing: DeepResearchBriefing): ResearchReportBullet[] {
  return [
    ...briefing.opportunities.applications.map((item) => ({
      label: item.label,
      detail: item.detail,
      href: item.href,
    })),
    ...briefing.opportunities.revenuePaths.map((item) => ({
      label: `Revenue: ${item.label}`,
      detail: item.detail,
      href: item.href,
    })),
    ...briefing.opportunities.salesOpportunities.map((item) => ({
      label: item.label,
      detail: item.detail,
      href: item.href,
    })),
  ];
}

function buildRiskBullets(briefing: DeepResearchBriefing): ResearchReportBullet[] {
  return [
    ...briefing.risks.commercial.map((item) => ({
      label: `[Commercial] ${item.label}`,
      detail: item.detail,
    })),
    ...briefing.risks.relationship.map((item) => ({
      label: `[Relationship] ${item.label}`,
      detail: item.detail,
    })),
    ...briefing.risks.competitive.map((item) => ({
      label: `[Competitive] ${item.label}`,
      detail: item.detail,
    })),
  ];
}

function section(
  id: ResearchReportSectionId,
  paragraphs: string[],
  bullets: ResearchReportBullet[] = [],
): ResearchReportSection {
  return {
    id,
    title: RESEARCH_REPORT_SECTION_LABELS[id],
    paragraphs,
    bullets,
  };
}

export function buildResearchReportFromBriefing(
  briefing: DeepResearchBriefing,
  options: {
    generatedBy?: string;
    existingReportCount?: number;
    companyId?: string;
    dealId?: string;
    contactId?: string;
  } = {},
): ResearchReport {
  const type = reportTypeForBriefing(briefing);
  const typeLabel = RESEARCH_REPORT_TYPE_LABELS[type];
  const reportId = nextReportId(options.existingReportCount ?? 0);
  const subjectSlug = slugify(briefing.subjectLabel);
  const dateStamp = new Date().toISOString().slice(0, 10);
  const fileLeafRef = `${reportId}_${typeLabel.replace(/\s+/g, "-")}_${subjectSlug}.docx`;
  const sharePointPath = `/sites/SmartCRM/ResearchReports/${dateStamp}/${fileLeafRef}`;

  const executiveParagraphs = [
    briefing.executiveSummary.narrative,
    [
      briefing.executiveSummary.industry && `Industry: ${briefing.executiveSummary.industry}`,
      briefing.executiveSummary.location && `Location: ${briefing.executiveSummary.location}`,
      briefing.executiveSummary.size && `Size: ${briefing.executiveSummary.size}`,
      `Focus: ${briefing.executiveSummary.businessFocus}`,
    ]
      .filter(Boolean)
      .join(" · "),
  ];

  const relationshipParagraphs: string[] = [];
  if (briefing.knownRelationship.relationshipHealth) {
    relationshipParagraphs.push(
      `Relationship health: ${briefing.knownRelationship.relationshipHealth}`,
    );
  }
  if (briefing.knownRelationship.lastContact) {
    relationshipParagraphs.push(`Last contact: ${briefing.knownRelationship.lastContact}`);
  }

  const sectionsMap: Record<ResearchReportSectionId, ResearchReportSection> = {
    executive_summary: section("executive_summary", executiveParagraphs),
    why_this_matters: section("why_this_matters", briefing.whyItMatters),
    findings: section("findings", relationshipParagraphs, buildFindings(briefing)),
    opportunities: section("opportunities", [], buildOpportunityBullets(briefing)),
    risks: section("risks", [], buildRiskBullets(briefing)),
    recommended_actions: section(
      "recommended_actions",
      [],
      briefing.recommendedActions.map((item) => ({
        label: item.label,
        detail: item.detail,
        href: item.href,
      })),
    ),
    strategic_assessment: section("strategic_assessment", [
      `${briefing.overallAssessment.priority.toUpperCase()} priority — ${briefing.overallAssessment.strategicPriority}`,
      briefing.overallAssessment.summary,
    ]),
    sources: section("sources", [], briefing.sourcesUsed.map((source) => ({ label: source }))),
  };

  const sections = RESEARCH_REPORT_SECTION_ORDER.map((id) => sectionsMap[id]);

  return {
    id: `report-${reportId}`,
    reportId,
    type,
    typeLabel,
    title: `${typeLabel}: ${briefing.subjectLabel}`,
    subject: briefing.subjectLabel,
    generatedAt: new Date().toISOString(),
    docCategory: type === "opportunity_assessment" ? "Commercial" : "Operational",
    docType: docTypeForReport(type),
    revision: "01",
    priority: briefing.overallAssessment.priority,
    strategicPriority: briefing.overallAssessment.strategicPriority,
    sections,
    metadata: {
      companyId: options.companyId,
      companyName: briefing.kind === "company" || briefing.kind === "competitor" ? briefing.subjectLabel : undefined,
      dealId: options.dealId,
      contactId: options.contactId,
      contactName: briefing.kind === "contact" ? briefing.subjectLabel : undefined,
      generatedBy: options.generatedBy ?? "SmartAssist",
      sharePointPath,
      sharePointUrl: `https://standardbio.sharepoint.com${sharePointPath}`,
    },
    sourceQuery: briefing.query,
    briefingId: briefing.id,
  };
}

export function reportSearchableText(report: ResearchReport): string {
  const sectionText = report.sections
    .flatMap((s) => [...s.paragraphs, ...s.bullets.map((b) => `${b.label} ${b.detail ?? ""}`)])
    .join(" ");
  return [
    report.title,
    report.subject,
    report.typeLabel,
    report.metadata.companyName,
    report.metadata.dealId,
    report.sourceQuery,
    sectionText,
  ]
    .filter(Boolean)
    .join(" ");
}

export function findPriorReportsForSubject(
  reports: import("@/types/research-report").StoredResearchReport[],
  subject: string,
): import("@/types/research-report").StoredResearchReport[] {
  const q = subject.toLowerCase();
  return reports
    .filter(
      (report) =>
        report.subject.toLowerCase().includes(q) ||
        q.includes(report.subject.toLowerCase()) ||
        report.searchableText.toLowerCase().includes(q),
    )
    .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))
    .slice(0, 5);
}
