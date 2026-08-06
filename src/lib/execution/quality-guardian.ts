/**
 * FAT/SAT & ISO 9001 Quality Gate Guardian
 * Reality First: only recorded inspections and NCRs block advancement — never invent findings.
 */

import { withPrismaRetry } from "@/lib/prisma";
import type {
  QualityGateCheck,
  QualityInspectionRecord,
  QualityInspectionStatus,
  QualityInspectionType,
  QualityProjectSummary,
} from "@/lib/execution/quality-guardian-types";

export type {
  QualityGateCheck,
  QualityInspectionRecord,
  QualityInspectionStatus,
  QualityInspectionType,
  QualityProjectSummary,
} from "@/lib/execution/quality-guardian-types";
export {
  INSPECTION_STATUS_LABELS,
  INSPECTION_TYPE_LABELS,
  INSPECTION_TYPE_OPTIONS,
} from "@/lib/execution/quality-guardian-types";

export type LogQualityInspectionPayload = {
  projectId: string;
  milestoneId?: string | null;
  inspectionType: QualityInspectionType;
  status: QualityInspectionStatus;
  title: string;
  ncrDescription?: string | null;
  remediationPlan?: string | null;
  inspectorName?: string | null;
};

export type ResolveNcrPayload = {
  projectId: string;
  inspectionId: string;
  remediationPlan?: string | null;
  inspectorName?: string | null;
};

type PrismaInspectionRow = {
  id: string;
  projectId: string;
  milestoneId: string | null;
  inspectionType: QualityInspectionType;
  status: QualityInspectionStatus;
  title: string;
  ncrDescription: string | null;
  remediationPlan: string | null;
  inspectorName: string | null;
  signedOffAt: Date | null;
  createdAt: Date;
  milestone?: { stage: string; title: string } | null;
};

const OPEN_NCR_STATUSES: QualityInspectionStatus[] = [
  "FAILED_NCR",
  "PENDING_REMEDIATION",
];

function mapInspection(row: PrismaInspectionRow): QualityInspectionRecord {
  return {
    id: row.id,
    projectId: row.projectId,
    milestoneId: row.milestoneId,
    milestoneStage: row.milestone?.stage ?? null,
    milestoneTitle: row.milestone?.title ?? null,
    inspectionType: row.inspectionType,
    status: row.status,
    title: row.title,
    ncrDescription: row.ncrDescription,
    remediationPlan: row.remediationPlan,
    inspectorName: row.inspectorName,
    signedOffAt: row.signedOffAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function isPassedType(
  inspections: QualityInspectionRecord[],
  type: QualityInspectionType,
): boolean {
  return inspections.some(
    (row) => row.inspectionType === type && row.status === "PASSED",
  );
}

/**
 * Create an inspection record. FAILED_NCR / PENDING_REMEDIATION → project AT_RISK.
 */
export async function logQualityInspection(
  payload: LogQualityInspectionPayload,
): Promise<QualityInspectionRecord> {
  const title = payload.title.trim();
  if (!title) throw new Error("title is required");

  const project = await withPrismaRetry((prisma) =>
    prisma.project.findUnique({ where: { id: payload.projectId } }),
  );
  if (!project) throw new Error("Project not found");

  if (payload.milestoneId) {
    const milestone = await withPrismaRetry((prisma) =>
      prisma.projectMilestone.findFirst({
        where: { id: payload.milestoneId!, projectId: payload.projectId },
      }),
    );
    if (!milestone) throw new Error("Milestone not found on this project");
  }

  const isFailure =
    payload.status === "FAILED_NCR" || payload.status === "PENDING_REMEDIATION";

  const created = await withPrismaRetry((prisma) =>
    prisma.$transaction(async (tx) => {
      const inspection = await tx.qualityInspection.create({
        data: {
          projectId: payload.projectId,
          milestoneId: payload.milestoneId ?? null,
          inspectionType: payload.inspectionType,
          status: payload.status,
          title,
          ncrDescription: payload.ncrDescription?.trim() || null,
          remediationPlan: payload.remediationPlan?.trim() || null,
          inspectorName: payload.inspectorName?.trim() || null,
          signedOffAt: payload.status === "PASSED" ? new Date() : null,
        },
        include: { milestone: { select: { stage: true, title: true } } },
      });

      if (isFailure) {
        await tx.project.update({
          where: { id: payload.projectId },
          data: { healthStatus: "AT_RISK" },
        });
      }

      return inspection;
    }),
  );

  return mapInspection(created as PrismaInspectionRow);
}

/**
 * Resolve an open NCR — mark PASSED after remediation is recorded.
 */
export async function resolveQualityNcr(
  payload: ResolveNcrPayload,
): Promise<QualityInspectionRecord> {
  const existing = await withPrismaRetry((prisma) =>
    prisma.qualityInspection.findFirst({
      where: { id: payload.inspectionId, projectId: payload.projectId },
      include: { milestone: { select: { stage: true, title: true } } },
    }),
  );
  if (!existing) throw new Error("Inspection not found");
  if (existing.status === "PASSED") {
    return mapInspection(existing as PrismaInspectionRow);
  }

  const updated = await withPrismaRetry((prisma) =>
    prisma.$transaction(async (tx) => {
      const inspection = await tx.qualityInspection.update({
        where: { id: payload.inspectionId },
        data: {
          status: "PASSED",
          remediationPlan:
            payload.remediationPlan?.trim() || existing.remediationPlan,
          inspectorName:
            payload.inspectorName?.trim() || existing.inspectorName,
          signedOffAt: new Date(),
        },
        include: { milestone: { select: { stage: true, title: true } } },
      });

      const remainingOpen = await tx.qualityInspection.count({
        where: {
          projectId: payload.projectId,
          status: { in: OPEN_NCR_STATUSES },
        },
      });

      if (remainingOpen === 0) {
        await tx.project.update({
          where: { id: payload.projectId },
          data: { healthStatus: "ON_TRACK" },
        });
      }

      return inspection;
    }),
  );

  return mapInspection(updated as PrismaInspectionRow);
}

/**
 * Gate check: block stage advancement when open NCRs exist for that stage.
 */
export async function verifyGateQualityPass(
  projectId: string,
  stageName: string,
): Promise<QualityGateCheck> {
  const inspections = await withPrismaRetry((prisma) =>
    prisma.qualityInspection.findMany({
      where: {
        projectId,
        status: { in: OPEN_NCR_STATUSES },
      },
      include: { milestone: { select: { stage: true, title: true } } },
      orderBy: { createdAt: "desc" },
    }),
  );

  const mapped = (inspections as PrismaInspectionRow[]).map(mapInspection);
  const stageLower = stageName.trim().toLowerCase();

  const blockingNCRs = mapped.filter((row) => {
    if (!row.milestoneStage && !row.milestoneTitle) {
      // Project-level open NCR blocks any advancement
      return true;
    }
    const stage = (row.milestoneStage ?? "").toLowerCase();
    const title = (row.milestoneTitle ?? "").toLowerCase();
    return (
      stage === stageLower ||
      title === stageLower ||
      stage.includes(stageLower) ||
      stageLower.includes(stage) ||
      title.includes(stageLower)
    );
  });

  return {
    canAdvance: blockingNCRs.length === 0,
    blockingNCRs,
  };
}

export async function getProjectQualitySummary(
  projectId: string,
): Promise<QualityProjectSummary> {
  const project = await withPrismaRetry((prisma) =>
    prisma.project.findUnique({ where: { id: projectId } }),
  );
  if (!project) throw new Error("Project not found");

  const rows = await withPrismaRetry((prisma) =>
    prisma.qualityInspection.findMany({
      where: { projectId },
      include: { milestone: { select: { stage: true, title: true } } },
      orderBy: { createdAt: "desc" },
    }),
  );

  const inspections = (rows as PrismaInspectionRow[]).map(mapInspection);
  const openNCRs = inspections.filter((row) =>
    OPEN_NCR_STATUSES.includes(row.status),
  );

  return {
    projectId,
    inspections,
    openNCRs,
    fatPassed: isPassedType(inspections, "FAT_FACTORY_TEST"),
    satPassed: isPassedType(inspections, "SAT_SITE_TEST"),
    isoAuditPassed: isPassedType(inspections, "ISO_QUALITY_AUDIT"),
  };
}
