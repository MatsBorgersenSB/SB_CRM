import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import { getLifecycleStage } from "@/types/pipeline";
import type {
  BusinessImpactLevel,
  DocumentHealthStatus,
  DocumentRiskType,
  MissingDocumentStatus,
  SmartDocApprovalStatus,
  SmartDocRecord,
  SmartDocReviewStatus,
  SmartDocTimelineEvent,
} from "@/types/smartdoc";
import { healthStatusFromScore } from "@/lib/relationship-health-engine";
import {
  getActivitiesReferencingDocument,
  getLinkedCompaniesForDocument,
  getLinkedContactsForDocument,
  getLinkedPipelineForDocument,
} from "@/lib/smartdoc-registry";
import {
  buildSmartDocTimeline,
  businessImpactNarrative,
  computeBusinessImpactLevel,
} from "@/lib/smartdoc-timeline";
import { daysBetween } from "@/lib/relative-time";

export type DocumentHealthComponent = {
  id: string;
  label: string;
  score: number;
  weight: number;
  weightedContribution: number;
  detail: string;
};

export type DocumentRiskSignal = {
  id: string;
  type: DocumentRiskType;
  label: string;
  detail: string;
  severity: "critical" | "warning" | "info";
};

export type DocumentSmartInsights = {
  businessImpact: string;
  businessImpactLevel: BusinessImpactLevel;
  usageFrequencyLabel: string;
  activityReferenceCount: number;
  opportunityReferenceCount: number;
  relationshipDependency: string;
  linkedCompanyCount: number;
  linkedContactCount: number;
};

export type DocumentNextBestAction = {
  id: string;
  action: string;
  reason: string;
  priority: "High" | "Medium" | "Low";
  confidenceScore: number;
  ruleId: string;
};

export type DocumentIntelligence = {
  document: SmartDocRecord;
  healthScore: number;
  healthStatus: DocumentHealthStatus;
  reviewStatus: SmartDocReviewStatus;
  approvalStatus: SmartDocApprovalStatus;
  components: DocumentHealthComponent[];
  risks: DocumentRiskSignal[];
  insights: DocumentSmartInsights;
  nextBestAction: DocumentNextBestAction;
  summary: string;
  daysSinceLastReference: number | null;
  referenceCount: number;
  timeline: SmartDocTimelineEvent[];
  ownerLabel: string | null;
};

export type RequiredDocumentSpec = {
  id: string;
  label: string;
  docCategory: string;
  docType?: string;
  critical: boolean;
};

export type MissingDocumentItem = {
  spec: RequiredDocumentSpec;
  status: MissingDocumentStatus;
  detail: string;
};

export type MissingDocumentsReport = {
  entityId: string;
  entityName: string;
  entityKind: "company" | "deal";
  items: MissingDocumentItem[];
  criticalCount: number;
  missingCount: number;
};

const WEIGHTS = {
  review_freshness: 0.2,
  approval_status: 0.2,
  version_currency: 0.15,
  metadata_completeness: 0.15,
  ownership: 0.15,
  usage_frequency: 0.15,
};

const REVIEW_OVERDUE_DAYS = 90;
const REVIEW_DUE_DAYS = 60;
const CERTIFICATE_EXPIRY_REVISION = 2;

const REQUIRED_BY_STAGE: Record<
  ReturnType<typeof getLifecycleStage>,
  RequiredDocumentSpec[]
> = {
  sales: [
    { id: "nda", label: "NDA / Legal Agreement", docCategory: "Legal", critical: true },
    { id: "tech-spec", label: "Technical Specification", docCategory: "Technical", critical: false },
    { id: "proposal", label: "Proposal / Commercial", docCategory: "Financial", critical: false },
  ],
  delivery: [
    { id: "tech-datasheet", label: "Technical Datasheet", docCategory: "Technical", critical: true },
    { id: "compliance", label: "Compliance Certificate", docCategory: "Compliance", critical: true },
    { id: "legal", label: "Contract Document", docCategory: "Legal", critical: false },
  ],
  production: [
    { id: "compliance-cert", label: "Compliance Certificate", docCategory: "Compliance", critical: true },
    { id: "financial", label: "Financial Report", docCategory: "Financial", critical: false },
  ],
};

function parseActivityDate(value: string): Date {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  return new Date(normalized);
}

function buildComponent(
  id: string,
  label: string,
  score: number,
  weight: number,
  detail: string,
): DocumentHealthComponent {
  return {
    id,
    label,
    score: Math.round(Math.max(0, Math.min(100, score))),
    weight,
    weightedContribution: Math.round(score * weight),
    detail,
  };
}

function scoreVersionCurrency(
  revision: string,
  pipeline: PipelineRow | undefined,
): { score: number; detail: string } {
  const revNum = Number.parseInt(revision, 10) || 1;
  let score = revNum >= 3 ? 100 : revNum === 2 ? 85 : 60;

  if (
    pipeline &&
    ["Site Installation", "Commissioning Phase", "Live Production"].includes(pipeline.status) &&
    revNum < 2
  ) {
    score = Math.min(score, 40);
  }

  return {
    score,
    detail: `Revision ${revision}${pipeline ? ` · deal at ${pipeline.status}` : ""}`,
  };
}

function scoreReviewStatus(daysSinceRef: number | null): {
  score: number;
  status: SmartDocReviewStatus;
  detail: string;
} {
  if (daysSinceRef === null) {
    return { score: 25, status: "Unknown", detail: "Never referenced in activity timeline" };
  }
  if (daysSinceRef <= REVIEW_DUE_DAYS) {
    return { score: 100, status: "Current", detail: `Reviewed via activity ${daysSinceRef}d ago` };
  }
  if (daysSinceRef <= REVIEW_OVERDUE_DAYS) {
    return { score: 55, status: "Due", detail: `Review due — last reference ${daysSinceRef}d ago` };
  }
  return {
    score: 20,
    status: "Overdue",
    detail: `Review overdue — ${daysSinceRef}d since last reference`,
  };
}

function scoreApprovalStatus(
  doc: SmartDocRecord,
  pipeline: PipelineRow | undefined,
): { score: number; status: SmartDocApprovalStatus; detail: string } {
  const needsApproval =
    doc.docCategory === "Compliance" ||
    doc.docCategory === "Legal" ||
    pipeline?.status === "Contract Negotiation";

  if (!needsApproval) {
    return { score: 100, status: "Not Required", detail: "Approval not required for this category" };
  }

  const rev = Number.parseInt(doc.revision, 10) || 1;
  if (rev >= 2) {
    return { score: 100, status: "Approved", detail: `Revision ${doc.revision} approved` };
  }
  if (rev === 1) {
    return { score: 50, status: "Pending", detail: "Initial revision pending approval" };
  }
  return { score: 15, status: "Missing", detail: "Approval metadata missing" };
}

function scoreMetadataCompleteness(doc: SmartDocRecord): {
  score: number;
  detail: string;
} {
  const fields = [
    doc.clientLookup,
    doc.docCategory,
    doc.docType,
    doc.revision,
    doc.fileName,
  ];
  const filled = fields.filter((f) => f && f.trim().length > 0).length;
  const score = Math.round((filled / fields.length) * 100);
  return {
    score,
    detail: `${filled}/${fields.length} metadata fields complete`,
  };
}

function scoreUsageFrequency(count: number): { score: number; detail: string } {
  if (count >= 4) return { score: 100, detail: `${count} activity references` };
  if (count >= 2) return { score: 75, detail: `${count} activity references` };
  if (count === 1) return { score: 50, detail: "1 activity reference" };
  return { score: 20, detail: "Not referenced in activities" };
}

function scoreOwnership(
  refs: Activity[],
  companies: Company[],
): { score: number; detail: string; ownerLabel: string | null } {
  const activityOwner = refs.find((a) => a.ActivityOwner?.Title)?.ActivityOwner?.Title;
  const contactOwner = refs.find((a) => a.Contact?.Title)?.Contact?.Title;
  const accountOwner = companies.find((c) => c.AccountOwner?.Title)?.AccountOwner?.Title;

  const ownerLabel = activityOwner ?? accountOwner ?? contactOwner ?? null;

  if (activityOwner) {
    return { score: 100, detail: `Owner: ${activityOwner}`, ownerLabel };
  }
  if (accountOwner) {
    return { score: 80, detail: `Account owner: ${accountOwner}`, ownerLabel };
  }
  if (contactOwner) {
    return { score: 65, detail: `Contact steward: ${contactOwner}`, ownerLabel };
  }
  return { score: 20, detail: "No owner assigned", ownerLabel: null };
}

function detectDocumentRisks(
  doc: SmartDocRecord,
  pipeline: PipelineRow | undefined,
  refs: Activity[],
  reviewStatus: SmartDocReviewStatus,
  daysSinceRef: number | null,
  companies: Company[],
): DocumentRiskSignal[] {
  const risks: DocumentRiskSignal[] = [];
  const linkedCompanies = getLinkedCompaniesForDocument(doc, companies, pipeline ? [pipeline] : []);

  if (
    doc.docCategory === "Compliance" &&
    (Number.parseInt(doc.revision, 10) || 1) <= CERTIFICATE_EXPIRY_REVISION &&
    (daysSinceRef === null || daysSinceRef >= REVIEW_DUE_DAYS)
  ) {
    risks.push({
      id: `${doc.id}-expiring`,
      type: "expiring_certificate",
      label: "Expiring certificate",
      detail: "Compliance document may expire without renewal review",
      severity: "critical",
    });
  }

  const hasOwner = refs.some((a) => a.ActivityOwner?.Title || a.Contact?.Title);
  if (!hasOwner && linkedCompanies.every((c) => !c.AccountOwner)) {
    risks.push({
      id: `${doc.id}-owner`,
      type: "missing_owner",
      label: "Missing owner",
      detail: "No document owner or account owner assigned",
      severity: "warning",
    });
  }

  if (reviewStatus === "Overdue" || reviewStatus === "Due") {
    risks.push({
      id: `${doc.id}-review`,
      type: "missing_review",
      label: "Missing review",
      detail: `Document review ${reviewStatus.toLowerCase()}`,
      severity: reviewStatus === "Overdue" ? "critical" : "warning",
    });
  }

  if (
    doc.docCategory === "Technical" &&
    pipeline &&
    ["Site Installation", "Commissioning Phase", "Live Production"].includes(pipeline.status) &&
    (Number.parseInt(doc.revision, 10) || 1) < 2
  ) {
    risks.push({
      id: `${doc.id}-outdated-spec`,
      type: "outdated_specification",
      label: "Outdated specification",
      detail: `Deal at ${pipeline.status} but specification remains revision ${doc.revision}`,
      severity: "warning",
    });
  }

  if (
    pipeline &&
    ["Contract Negotiation", "Reactor Manufacturing", "Site Installation"].includes(
      pipeline.status,
    ) &&
    refs.length === 0
  ) {
    risks.push({
      id: `${doc.id}-critical-dep`,
      type: "critical_opportunity_dependency",
      label: "Critical opportunity dependency",
      detail: `${pipeline.assetName} depends on this document with no activity trail`,
      severity: "critical",
    });
  }

  return risks;
}

function buildInsights(
  doc: SmartDocRecord,
  pipeline: PipelineRow | undefined,
  refs: Activity[],
  companies: Company[],
  risks: DocumentRiskSignal[],
  contactCount: number,
): DocumentSmartInsights {
  const linked = getLinkedCompaniesForDocument(doc, companies, pipeline ? [pipeline] : []);
  const oppCount = pipeline ? 1 : 0;
  const businessImpactLevel = computeBusinessImpactLevel(
    doc,
    pipeline,
    refs,
    linked,
    risks.length,
  );

  return {
    businessImpact: businessImpactNarrative(businessImpactLevel, doc, pipeline, linked),
    businessImpactLevel,
    usageFrequencyLabel:
      refs.length >= 3 ? "High" : refs.length >= 1 ? "Moderate" : "Low",
    activityReferenceCount: refs.length,
    opportunityReferenceCount: oppCount,
    relationshipDependency:
      linked.length > 0
        ? `${linked.map((c) => c.Title).join(", ")} depend on this document`
        : "No linked company relationship",
    linkedCompanyCount: linked.length,
    linkedContactCount: contactCount,
  };
}

function resolveDocumentNextBestAction(
  doc: SmartDocRecord,
  risks: DocumentRiskSignal[],
  reviewStatus: SmartDocReviewStatus,
): DocumentNextBestAction {
  const critical = risks.find((r) => r.severity === "critical");
  if (critical?.type === "expiring_certificate") {
    return {
      id: `doc-nba-renew-${doc.id}`,
      action: "Renew Certificate",
      reason: critical.detail,
      priority: "High",
      confidenceScore: 92,
      ruleId: "renew_certificate",
    };
  }
  if (critical?.type === "critical_opportunity_dependency") {
    return {
      id: `doc-nba-link-${doc.id}`,
      action: "Link Document to Activity",
      reason: critical.detail,
      priority: "High",
      confidenceScore: 90,
      ruleId: "link_activity",
    };
  }
  if (reviewStatus === "Overdue") {
    return {
      id: `doc-nba-review-${doc.id}`,
      action: "Schedule Document Review",
      reason: "Review is overdue — update revision or confirm validity",
      priority: "High",
      confidenceScore: 88,
      ruleId: "schedule_review",
    };
  }
  if (risks.some((r) => r.type === "missing_owner")) {
    return {
      id: `doc-nba-owner-${doc.id}`,
      action: "Assign Document Owner",
      reason: "No accountable owner for this business asset",
      priority: "Medium",
      confidenceScore: 80,
      ruleId: "assign_owner",
    };
  }
  if (risks.some((r) => r.type === "outdated_specification")) {
    return {
      id: `doc-nba-revise-${doc.id}`,
      action: "Upload Revised Specification",
      reason: "Deal stage advanced beyond current document revision",
      priority: "Medium",
      confidenceScore: 85,
      ruleId: "upload_revision",
    };
  }
  return {
    id: `doc-nba-maintain-${doc.id}`,
    action: "Confirm Document Currency",
    reason: "Document is healthy — confirm metadata and references remain accurate",
    priority: "Low",
    confidenceScore: 65,
    ruleId: "maintain_currency",
  };
}

export function computeDocumentIntelligence(
  document: SmartDocRecord,
  pipelines: PipelineRow[],
  companies: Company[],
  activities: Activity[],
): DocumentIntelligence {
  const pipeline = getLinkedPipelineForDocument(document, pipelines);
  const refs = getActivitiesReferencingDocument(document, activities);
  const sorted = [...refs].sort(
    (a, b) =>
      parseActivityDate(b.ActivityDate).getTime() -
      parseActivityDate(a.ActivityDate).getTime(),
  );
  const lastRef = sorted[0];
  const daysSinceRef = lastRef ? daysBetween(lastRef.ActivityDate) : null;

  const linkedCompanies = getLinkedCompaniesForDocument(document, companies, pipelines);
  const contacts = getLinkedContactsForDocument(document, linkedCompanies, activities);

  const version = scoreVersionCurrency(document.revision, pipeline);
  const review = scoreReviewStatus(daysSinceRef);
  const approval = scoreApprovalStatus(document, pipeline);
  const metadata = scoreMetadataCompleteness(document);
  const ownership = scoreOwnership(refs, linkedCompanies);
  const usage = scoreUsageFrequency(refs.length);

  const components = [
    buildComponent(
      "review_freshness",
      "Review Freshness",
      review.score,
      WEIGHTS.review_freshness,
      review.detail,
    ),
    buildComponent(
      "approval_status",
      "Approval Status",
      approval.score,
      WEIGHTS.approval_status,
      approval.detail,
    ),
    buildComponent(
      "version_currency",
      "Version Currency",
      version.score,
      WEIGHTS.version_currency,
      version.detail,
    ),
    buildComponent(
      "metadata_completeness",
      "Metadata Completeness",
      metadata.score,
      WEIGHTS.metadata_completeness,
      metadata.detail,
    ),
    buildComponent("ownership", "Ownership", ownership.score, WEIGHTS.ownership, ownership.detail),
    buildComponent(
      "usage_frequency",
      "Usage Frequency",
      usage.score,
      WEIGHTS.usage_frequency,
      usage.detail,
    ),
  ];

  let healthScore = components.reduce((sum, c) => sum + c.weightedContribution, 0);
  healthScore = Math.round(Math.max(0, Math.min(100, healthScore)));
  const healthStatus = healthStatusFromScore(healthScore) as DocumentHealthStatus;

  const risks = detectDocumentRisks(
    document,
    pipeline,
    refs,
    review.status,
    daysSinceRef,
    companies,
  );
  const insights = buildInsights(
    document,
    pipeline,
    refs,
    companies,
    risks,
    contacts.length,
  );
  const nextBestAction = resolveDocumentNextBestAction(document, risks, review.status);
  const revNum = Number.parseInt(document.revision, 10) || 1;
  const timeline = buildSmartDocTimeline(document, activities, revNum);

  return {
    document,
    healthScore,
    healthStatus,
    reviewStatus: review.status,
    approvalStatus: approval.status,
    components,
    risks,
    insights,
    nextBestAction,
    summary: `${healthStatus} · ${insights.businessImpactLevel} impact · ${review.status} review`,
    daysSinceLastReference: daysSinceRef,
    referenceCount: refs.length,
    timeline,
    ownerLabel: ownership.ownerLabel,
  };
}

function documentMatchesSpec(
  docs: SmartDocRecord[],
  spec: RequiredDocumentSpec,
): SmartDocRecord | undefined {
  return docs.find(
    (d) =>
      d.docCategory.toLowerCase() === spec.docCategory.toLowerCase() &&
      (!spec.docType || d.docType.toLowerCase().includes(spec.docType.toLowerCase())),
  );
}

export function computeMissingDocumentsForDeal(
  deal: PipelineRow,
  allDocs: SmartDocRecord[],
): MissingDocumentsReport {
  const dealDocs = allDocs.filter(
    (d) => d.pipelineId === deal.id || d.clientLookup === deal.id,
  );
  const specs = REQUIRED_BY_STAGE[getLifecycleStage(deal.status)];

  const items: MissingDocumentItem[] = specs.map((spec) => {
    const match = documentMatchesSpec(dealDocs, spec);
    if (match) {
      return { spec, status: "present" as const, detail: match.fileName };
    }
    return {
      spec,
      status: spec.critical ? ("critical_missing" as const) : ("missing" as const),
      detail: spec.critical ? "Required for deal stage — not found" : "Recommended — not uploaded",
    };
  });

  return {
    entityId: deal.id,
    entityName: deal.assetName,
    entityKind: "deal",
    items,
    criticalCount: items.filter((i) => i.status === "critical_missing").length,
    missingCount: items.filter((i) => i.status !== "present").length,
  };
}

export function computeMissingDocumentsForCompany(
  company: Company,
  pipelines: PipelineRow[],
  allDocs: SmartDocRecord[],
): MissingDocumentsReport {
  const linked = pipelines.filter((p) => company.pipelineIds.includes(p.id));
  const companyDocs = allDocs.filter(
    (d) =>
      linked.some((p) => p.id === d.pipelineId) ||
      company.pipelineIds.includes(d.clientLookup),
  );

  const specs: RequiredDocumentSpec[] = [
    { id: "nda", label: "Master NDA", docCategory: "Legal", critical: true },
    { id: "compliance", label: "Compliance Pack", docCategory: "Compliance", critical: false },
  ];

  const items: MissingDocumentItem[] = specs.map((spec) => {
    const match = documentMatchesSpec(companyDocs, spec);
    if (match) return { spec, status: "present", detail: match.fileName };
    return {
      spec,
      status: spec.critical ? "critical_missing" : "missing",
      detail: spec.critical ? "Required for account governance" : "Recommended documentation",
    };
  });

  return {
    entityId: company.CompanyID,
    entityName: company.Title,
    entityKind: "company",
    items,
    criticalCount: items.filter((i) => i.status === "critical_missing").length,
    missingCount: items.filter((i) => i.status !== "present").length,
  };
}

export function computeAllDocumentIntelligence(
  pipelines: PipelineRow[],
  companies: Company[],
  activities: Activity[],
  documents: SmartDocRecord[],
): DocumentIntelligence[] {
  return documents.map((doc) =>
    computeDocumentIntelligence(doc, pipelines, companies, activities),
  );
}

export function getDocumentIntelligenceExplanation(): string {
  return (
    "Document Health (0–100) combines Review Freshness (20%), Approval Status (20%), " +
    "Version Currency (15%), Metadata Completeness (15%), Ownership (15%), and Usage Frequency (15%). " +
    "Business Impact: Low / Medium / High / Critical. Documents are knowledge intelligence assets."
  );
}

export { REQUIRED_BY_STAGE };
