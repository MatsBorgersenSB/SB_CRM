/** Quality Gate Guardian types — safe for client components. */

export type QualityInspectionType =
  | "FAT_FACTORY_TEST"
  | "SAT_SITE_TEST"
  | "ISO_QUALITY_AUDIT"
  | "SAFETY_CHECK";

export type QualityInspectionStatus =
  | "PASSED"
  | "FAILED_NCR"
  | "PENDING_REMEDIATION";

export type QualityInspectionRecord = {
  id: string;
  projectId: string;
  milestoneId: string | null;
  milestoneStage: string | null;
  milestoneTitle: string | null;
  inspectionType: QualityInspectionType;
  status: QualityInspectionStatus;
  title: string;
  ncrDescription: string | null;
  remediationPlan: string | null;
  inspectorName: string | null;
  signedOffAt: string | null;
  createdAt: string;
};

export type QualityGateCheck = {
  canAdvance: boolean;
  blockingNCRs: QualityInspectionRecord[];
};

export type QualityProjectSummary = {
  projectId: string;
  inspections: QualityInspectionRecord[];
  openNCRs: QualityInspectionRecord[];
  fatPassed: boolean;
  satPassed: boolean;
  isoAuditPassed: boolean;
};

export const INSPECTION_TYPE_LABELS: Record<QualityInspectionType, string> = {
  FAT_FACTORY_TEST: "FAT — Factory Acceptance Test",
  SAT_SITE_TEST: "SAT — Site Acceptance Test",
  ISO_QUALITY_AUDIT: "ISO 9001 Quality Audit",
  SAFETY_CHECK: "Safety Check",
};

export const INSPECTION_STATUS_LABELS: Record<QualityInspectionStatus, string> = {
  PASSED: "Passed",
  FAILED_NCR: "Failed — NCR",
  PENDING_REMEDIATION: "Pending Remediation",
};

export const INSPECTION_TYPE_OPTIONS: Array<{
  id: QualityInspectionType;
  label: string;
}> = [
  { id: "FAT_FACTORY_TEST", label: "FAT — Factory Test" },
  { id: "SAT_SITE_TEST", label: "SAT — Site Test" },
  { id: "ISO_QUALITY_AUDIT", label: "ISO 9001 Audit" },
  { id: "SAFETY_CHECK", label: "Safety Check" },
];
