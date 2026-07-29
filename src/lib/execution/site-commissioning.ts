/**
 * Site Commissioning & Safety Check-In Co-Pilot
 * Reality First: field logs and safety flags are recorded as stated — never invent readings.
 */

import { withPrismaRetry } from "@/lib/prisma";
import type { ProjectHealthStatus } from "@/lib/execution/project-generator-types";
import type {
  CommissioningLogRecord,
  CommissioningPhase,
  CommissioningPhaseStatus,
  CommissioningSummary,
} from "@/lib/execution/site-commissioning-types";
import { COMMISSIONING_PHASE_LABELS } from "@/lib/execution/site-commissioning-types";

export type {
  CommissioningLogRecord,
  CommissioningPhase,
  CommissioningPhaseStatus,
  CommissioningSummary,
} from "@/lib/execution/site-commissioning-types";
export {
  COMMISSIONING_PHASE_LABELS,
  COMMISSIONING_PHASE_OPTIONS,
} from "@/lib/execution/site-commissioning-types";

export type RecordCommissioningLogPayload = {
  projectId: string;
  phase: CommissioningPhase;
  safetyCheckPassed: boolean;
  atexZoningVerified: boolean;
  logTitle: string;
  operationalNotes?: string | null;
  issuesEncountered?: string | null;
  loggedBy?: string | null;
};

const PHASE_ORDER: CommissioningPhase[] = [
  "COLD_COMMISSIONING",
  "HOT_COMMISSIONING",
  "SYNGAS_TESTING",
  "PERFORMANCE_RUN",
];

type PrismaLogRow = {
  id: string;
  projectId: string;
  phase: CommissioningPhase;
  safetyCheckPassed: boolean;
  atexZoningVerified: boolean;
  logTitle: string;
  operationalNotes: string | null;
  issuesEncountered: string | null;
  loggedBy: string | null;
  createdAt: Date;
};

function mapLog(row: PrismaLogRow): CommissioningLogRecord {
  return {
    id: row.id,
    projectId: row.projectId,
    phase: row.phase,
    safetyCheckPassed: row.safetyCheckPassed,
    atexZoningVerified: row.atexZoningVerified,
    logTitle: row.logTitle,
    operationalNotes: row.operationalNotes,
    issuesEncountered: row.issuesEncountered,
    loggedBy: row.loggedBy,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Record a commissioning / daily field safety check-in.
 * Failed safety or ATEX → AT_RISK + open Safety Item (QualityInspection SAFETY_CHECK NCR).
 */
export async function recordCommissioningLog(
  payload: RecordCommissioningLogPayload,
): Promise<{
  commissioningLog: CommissioningLogRecord;
  projectHealthStatus: ProjectHealthStatus;
  safetyItemId: string | null;
}> {
  const logTitle = payload.logTitle.trim();
  if (!logTitle) throw new Error("logTitle is required");

  const project = await withPrismaRetry((prisma) =>
    prisma.project.findUnique({ where: { id: payload.projectId } }),
  );
  if (!project) throw new Error("Project not found");

  const safetyFailed =
    !payload.safetyCheckPassed || !payload.atexZoningVerified;

  const result = await withPrismaRetry((prisma) =>
    prisma.$transaction(async (tx) => {
      const log = await tx.commissioningLog.create({
        data: {
          projectId: payload.projectId,
          phase: payload.phase,
          safetyCheckPassed: payload.safetyCheckPassed,
          atexZoningVerified: payload.atexZoningVerified,
          logTitle,
          operationalNotes: payload.operationalNotes?.trim() || null,
          issuesEncountered: payload.issuesEncountered?.trim() || null,
          loggedBy: payload.loggedBy?.trim() || null,
        },
      });

      let safetyItemId: string | null = null;
      let healthStatus = project.healthStatus as ProjectHealthStatus;

      if (safetyFailed) {
        const reasons: string[] = [];
        if (!payload.safetyCheckPassed) reasons.push("Safety check not passed");
        if (!payload.atexZoningVerified) reasons.push("ATEX zoning not verified");

        const safetyItem = await tx.qualityInspection.create({
          data: {
            projectId: payload.projectId,
            inspectionType: "SAFETY_CHECK",
            status: "FAILED_NCR",
            title: `Safety hold — ${logTitle}`,
            ncrDescription: [
              `Commissioning phase: ${COMMISSIONING_PHASE_LABELS[payload.phase]}`,
              ...reasons,
              payload.issuesEncountered?.trim()
                ? `Issues: ${payload.issuesEncountered.trim()}`
                : null,
            ]
              .filter(Boolean)
              .join(". "),
            remediationPlan:
              "Do not proceed to next commissioning step until safety/ATEX sign-off is recorded.",
            inspectorName: payload.loggedBy?.trim() || null,
          },
        });
        safetyItemId = safetyItem.id;

        const updated = await tx.project.update({
          where: { id: payload.projectId },
          data: { healthStatus: "AT_RISK" },
        });
        healthStatus = updated.healthStatus as ProjectHealthStatus;
      }

      return { log, healthStatus, safetyItemId };
    }),
  );

  return {
    commissioningLog: mapLog(result.log as PrismaLogRow),
    projectHealthStatus: result.healthStatus,
    safetyItemId: result.safetyItemId,
  };
}

export async function getCommissioningSummary(
  projectId: string,
): Promise<CommissioningSummary> {
  const project = await withPrismaRetry((prisma) =>
    prisma.project.findUnique({ where: { id: projectId } }),
  );
  if (!project) throw new Error("Project not found");

  const [logs, openSafety] = await Promise.all([
    withPrismaRetry((prisma) =>
      prisma.commissioningLog.findMany({
        where: { projectId },
        orderBy: { createdAt: "desc" },
      }),
    ),
    withPrismaRetry((prisma) =>
      prisma.qualityInspection.count({
        where: {
          projectId,
          inspectionType: "SAFETY_CHECK",
          status: { in: ["FAILED_NCR", "PENDING_REMEDIATION"] },
        },
      }),
    ),
  ]);

  const mapped = (logs as PrismaLogRow[]).map(mapLog);

  const phases: CommissioningPhaseStatus[] = PHASE_ORDER.map((phase) => {
    const phaseLogs = mapped.filter((l) => l.phase === phase);
    return {
      phase,
      label: COMMISSIONING_PHASE_LABELS[phase],
      logCount: phaseLogs.length,
      lastLogAt: phaseLogs[0]?.createdAt ?? null,
      safetyEverPassed: phaseLogs.some((l) => l.safetyCheckPassed),
      atexEverVerified: phaseLogs.some((l) => l.atexZoningVerified),
    };
  });

  const atexVerified = mapped.some((l) => l.atexZoningVerified);
  const syngasEsdTested = mapped.some(
    (l) =>
      l.phase === "SYNGAS_TESTING" &&
      l.safetyCheckPassed &&
      l.atexZoningVerified,
  );
  const thermalLimitsOk = mapped.some(
    (l) =>
      (l.phase === "HOT_COMMISSIONING" || l.phase === "PERFORMANCE_RUN") &&
      l.safetyCheckPassed &&
      !l.issuesEncountered,
  );

  return {
    projectId: project.id,
    projectTitle: project.title,
    projectHealthStatus: project.healthStatus as ProjectHealthStatus,
    logs: mapped,
    phases,
    atexVerified,
    syngasEsdTested,
    thermalLimitsOk,
    openSafetyItemCount: openSafety,
  };
}
