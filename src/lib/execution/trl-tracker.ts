/**
 * TRL & Internal R&D Milestone Tracker
 * Reality First: experiment findings are logged as stated; Decision Journal preserves memory — never invents results.
 */

import { withPrismaRetry } from "@/lib/prisma";
import type {
  IpFilingStatus,
  RdExperimentLogRecord,
  TrlProgressionSummary,
} from "@/lib/execution/trl-tracker-types";

export type {
  IpFilingStatus,
  RdExperimentLogRecord,
  TrlProgressionSummary,
} from "@/lib/execution/trl-tracker-types";
export {
  FEEDSTOCK_SUGGESTIONS,
  IP_FILING_STATUS_LABELS,
  IP_FILING_STATUS_OPTIONS,
  TRL_LADDER,
} from "@/lib/execution/trl-tracker-types";

export type LogRdExperimentPayload = {
  projectId: string;
  experimentTitle: string;
  trlStage: number;
  feedstockType?: string | null;
  reactorTempCelsius?: number | null;
  residenceTimeMinutes?: number | null;
  yieldPercentage?: number | null;
  ipFilingStatus?: IpFilingStatus;
  keyFindings: string;
  loggedBy?: string | null;
  /** When true, advances Project.trlLevel to this experiment's stage if higher */
  validatesTargetCriteria?: boolean;
};

type PrismaExperimentRow = {
  id: string;
  projectId: string;
  experimentTitle: string;
  trlStage: number;
  feedstockType: string | null;
  reactorTempCelsius: number | null;
  residenceTimeMinutes: number | null;
  yieldPercentage: number | null;
  ipFilingStatus: IpFilingStatus;
  keyFindings: string;
  loggedBy: string | null;
  createdAt: Date;
};

function mapExperiment(row: PrismaExperimentRow): RdExperimentLogRecord {
  return {
    id: row.id,
    projectId: row.projectId,
    experimentTitle: row.experimentTitle,
    trlStage: row.trlStage,
    feedstockType: row.feedstockType,
    reactorTempCelsius: row.reactorTempCelsius,
    residenceTimeMinutes: row.residenceTimeMinutes,
    yieldPercentage: row.yieldPercentage,
    ipFilingStatus: row.ipFilingStatus,
    keyFindings: row.keyFindings,
    loggedBy: row.loggedBy,
    createdAt: row.createdAt.toISOString(),
  };
}

function assertTrlStage(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 9) {
    throw new Error("trlStage must be an integer from 1 to 9");
  }
  return value;
}

/**
 * Log an R&D experiment, optionally advance TRL, and sync findings to Decision Journal.
 */
export async function logRdExperiment(
  payload: LogRdExperimentPayload,
): Promise<{ experimentLog: RdExperimentLogRecord; updatedTrlLevel: number | null }> {
  const experimentTitle = payload.experimentTitle.trim();
  const keyFindings = payload.keyFindings.trim();
  if (!experimentTitle) throw new Error("experimentTitle is required");
  if (!keyFindings) throw new Error("keyFindings is required");

  const trlStage = assertTrlStage(payload.trlStage);
  const ipFilingStatus: IpFilingStatus = payload.ipFilingStatus ?? "NONE";

  const project = await withPrismaRetry((prisma) =>
    prisma.project.findUnique({ where: { id: payload.projectId } }),
  );
  if (!project) throw new Error("Project not found");
  if (project.projectType !== "INTERNAL_RD") {
    throw new Error("TRL tracker applies only to INTERNAL_RD projects");
  }

  const shouldAdvance =
    Boolean(payload.validatesTargetCriteria) &&
    (project.trlLevel == null || trlStage > project.trlLevel);

  const result = await withPrismaRetry((prisma) =>
    prisma.$transaction(async (tx) => {
      const experiment = await tx.rdExperimentLog.create({
        data: {
          projectId: payload.projectId,
          experimentTitle,
          trlStage,
          feedstockType: payload.feedstockType?.trim() || null,
          reactorTempCelsius:
            payload.reactorTempCelsius != null &&
            Number.isFinite(payload.reactorTempCelsius)
              ? payload.reactorTempCelsius
              : null,
          residenceTimeMinutes:
            payload.residenceTimeMinutes != null &&
            Number.isFinite(payload.residenceTimeMinutes)
              ? payload.residenceTimeMinutes
              : null,
          yieldPercentage:
            payload.yieldPercentage != null &&
            Number.isFinite(payload.yieldPercentage)
              ? payload.yieldPercentage
              : null,
          ipFilingStatus,
          keyFindings,
          loggedBy: payload.loggedBy?.trim() || null,
        },
      });

      let updatedTrlLevel = project.trlLevel;
      if (shouldAdvance) {
        const updated = await tx.project.update({
          where: { id: payload.projectId },
          data: { trlLevel: trlStage },
        });
        updatedTrlLevel = updated.trlLevel;

        // Align current stage label when TRL band advances
        const stageLabel =
          trlStage <= 3
            ? "TRL 1–3 Concept & Feasibility"
            : trlStage <= 6
              ? "TRL 4–6 Lab/Pilot Prototyping"
              : trlStage <= 8
                ? "TRL 7–8 Field Testing"
                : "TRL 9 Commercialization";
        await tx.project.update({
          where: { id: payload.projectId },
          data: { currentStage: stageLabel },
        });
      }

      await tx.decisionJournal.create({
        data: {
          companyId: project.companyId,
          opportunityId: project.opportunityId,
          decisionText: `R&D TRL ${trlStage}: ${experimentTitle}`,
          rationale: keyFindings,
          category: "Strategic",
          confidenceScore: payload.validatesTargetCriteria ? 0.85 : 0.7,
          sourceSnippet: [
            `TRL ${trlStage}`,
            payload.feedstockType?.trim()
              ? `Feedstock: ${payload.feedstockType.trim()}`
              : null,
            payload.yieldPercentage != null
              ? `Yield: ${payload.yieldPercentage}%`
              : null,
            `IP: ${ipFilingStatus}`,
          ]
            .filter(Boolean)
            .join(" · "),
          stakeholderName: payload.loggedBy?.trim() || null,
        },
      });

      return { experiment, updatedTrlLevel };
    }),
  );

  return {
    experimentLog: mapExperiment(result.experiment as PrismaExperimentRow),
    updatedTrlLevel: result.updatedTrlLevel,
  };
}

export async function getTrlProgressionSummary(
  projectId: string,
): Promise<TrlProgressionSummary> {
  const project = await withPrismaRetry((prisma) =>
    prisma.project.findUnique({ where: { id: projectId } }),
  );
  if (!project) throw new Error("Project not found");

  const rows = await withPrismaRetry((prisma) =>
    prisma.rdExperimentLog.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    }),
  );

  const experiments = (rows as PrismaExperimentRow[]).map(mapExperiment);
  const maxLoggedTrl =
    experiments.length === 0
      ? null
      : Math.max(...experiments.map((e) => e.trlStage));

  const ipHighlights = Array.from(
    new Set(
      experiments
        .map((e) => e.ipFilingStatus)
        .filter((s) => s !== "NONE"),
    ),
  );

  return {
    projectId: project.id,
    projectTitle: project.title,
    projectType: project.projectType,
    currentTrlLevel: project.trlLevel,
    experiments,
    maxLoggedTrl,
    ipHighlights,
  };
}
