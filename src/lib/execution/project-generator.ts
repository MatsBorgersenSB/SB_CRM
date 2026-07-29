/**
 * Multi-Track Stage-Gate Workspace Generator
 * Reality First: templates are fixed execution tracks — never invent customer milestones.
 */

import { findPrismaCompanyByRouteKey } from "@/lib/data/companies";
import { findPrismaOpportunityByRouteKey } from "@/lib/resolve-opportunity-route";
import { withPrismaRetry } from "@/lib/prisma";
import { verifyGateQualityPass } from "@/lib/execution/quality-guardian";
import type {
  ExecutionProjectType,
  ProjectHealthStatus,
  StageGateMilestone,
  StageGateProject,
} from "@/lib/execution/project-generator-types";

export type {
  ExecutionProjectType,
  ProjectHealthStatus,
  StageGateMilestone,
  StageGateProject,
} from "@/lib/execution/project-generator-types";
export {
  HEALTH_STATUS_LABELS,
  PROJECT_TYPE_LABELS,
  PROJECT_TYPE_OPTIONS,
} from "@/lib/execution/project-generator-types";

export type GenerateProjectInput = {
  title: string;
  projectType: ExecutionProjectType;
  companyId: string;
  opportunityId?: string | null;
};

type MilestoneTemplate = {
  title: string;
  stage: string;
  /** Starting TRL for INTERNAL_RD stages */
  trlLevel?: number;
};

const TURNKEY_PLANT_GATES: MilestoneTemplate[] = [
  { title: "Basic Engineering", stage: "1. Basic Engineering" },
  { title: "Detail Engineering", stage: "2. Detail Engineering" },
  { title: "Procurement", stage: "3. Procurement" },
  { title: "Fabrication & Assembly", stage: "4. Fabrication & Assembly" },
  { title: "FAT Testing", stage: "5. FAT Testing" },
  { title: "Site Delivery & SAT", stage: "6. Site Delivery & SAT" },
  { title: "Commissioning & Handover", stage: "7. Commissioning & Handover" },
];

const SINGLE_MACHINERY_GATES: MilestoneTemplate[] = [
  { title: "Spec Freeze", stage: "1. Spec Freeze" },
  { title: "Component Procurement", stage: "2. Component Procurement" },
  { title: "Assembly & FAT", stage: "3. Assembly & FAT" },
  { title: "Shipping & Logistics", stage: "4. Shipping & Logistics" },
  { title: "Installation Support", stage: "5. Installation Support" },
];

const INTERNAL_RD_GATES: MilestoneTemplate[] = [
  {
    title: "Concept & Feasibility",
    stage: "TRL 1–3 Concept & Feasibility",
    trlLevel: 1,
  },
  {
    title: "Lab / Pilot Prototyping",
    stage: "TRL 4–6 Lab/Pilot Prototyping",
    trlLevel: 4,
  },
  {
    title: "Field Testing",
    stage: "TRL 7–8 Field Testing",
    trlLevel: 7,
  },
  {
    title: "Commercialization",
    stage: "TRL 9 Commercialization",
    trlLevel: 9,
  },
];

function templateForType(projectType: ExecutionProjectType): MilestoneTemplate[] {
  switch (projectType) {
    case "TURNKEY_PLANT":
      return TURNKEY_PLANT_GATES;
    case "SINGLE_MACHINERY":
      return SINGLE_MACHINERY_GATES;
    case "INTERNAL_RD":
      return INTERNAL_RD_GATES;
    default:
      return TURNKEY_PLANT_GATES;
  }
}

type PrismaProjectRow = {
  id: string;
  title: string;
  projectType: ExecutionProjectType;
  currentStage: string;
  trlLevel: number | null;
  companyId: string;
  opportunityId: string | null;
  healthStatus: ProjectHealthStatus;
  createdAt: Date;
  updatedAt: Date;
  milestones: Array<{
    id: string;
    title: string;
    stage: string;
    isCompleted: boolean;
    dueDate: Date | null;
    completedAt: Date | null;
    sortOrder: number;
  }>;
};

function mapProject(row: PrismaProjectRow): StageGateProject {
  const milestones: StageGateMilestone[] = [...row.milestones]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((m) => ({
      id: m.id,
      title: m.title,
      stage: m.stage,
      isCompleted: m.isCompleted,
      dueDate: m.dueDate?.toISOString() ?? null,
      completedAt: m.completedAt?.toISOString() ?? null,
      sortOrder: m.sortOrder,
    }));

  const completed = milestones.filter((m) => m.isCompleted).length;
  const progressPercent =
    milestones.length === 0
      ? 0
      : Math.round((completed / milestones.length) * 100);

  return {
    id: row.id,
    title: row.title,
    projectType: row.projectType,
    currentStage: row.currentStage,
    trlLevel: row.trlLevel,
    companyId: row.companyId,
    opportunityId: row.opportunityId,
    healthStatus: row.healthStatus,
    milestones,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    progressPercent,
  };
}

const PROJECT_INCLUDE = {
  milestones: { orderBy: { sortOrder: "asc" as const } },
};

/**
 * Generate a Stage-Gate project from a fixed execution template.
 */
export async function generateProjectFromTemplate(
  input: GenerateProjectInput,
): Promise<StageGateProject> {
  const title = input.title.trim();
  if (!title) {
    throw new Error("title is required");
  }
  if (
    input.projectType !== "TURNKEY_PLANT" &&
    input.projectType !== "SINGLE_MACHINERY" &&
    input.projectType !== "INTERNAL_RD"
  ) {
    throw new Error(
      "projectType must be TURNKEY_PLANT | SINGLE_MACHINERY | INTERNAL_RD",
    );
  }

  const company = await findPrismaCompanyByRouteKey(input.companyId);
  if (!company) {
    throw new Error("Company not found");
  }

  let opportunityPrismaId: string | null = null;
  if (input.opportunityId?.trim()) {
    const opportunity = await findPrismaOpportunityByRouteKey(
      input.opportunityId.trim(),
    );
    if (!opportunity) {
      throw new Error("Opportunity not found");
    }
    opportunityPrismaId = opportunity.id;
  }

  const gates = templateForType(input.projectType);
  const firstStage = gates[0]!.stage;
  const initialTrl =
    input.projectType === "INTERNAL_RD" ? (gates[0]!.trlLevel ?? 1) : null;

  const created = await withPrismaRetry((prisma) =>
    prisma.project.create({
      data: {
        title,
        projectType: input.projectType,
        currentStage: firstStage,
        trlLevel: initialTrl,
        companyId: company.id,
        opportunityId: opportunityPrismaId,
        healthStatus: "ON_TRACK",
        milestones: {
          create: gates.map((gate, index) => ({
            title: gate.title,
            stage: gate.stage,
            sortOrder: index,
            isCompleted: false,
          })),
        },
      },
      include: PROJECT_INCLUDE,
    }),
  );

  return mapProject(created as PrismaProjectRow);
}

export async function listStageGateProjectsForCompany(
  companyId: string,
): Promise<StageGateProject[]> {
  const company = await findPrismaCompanyByRouteKey(companyId);
  if (!company) return [];

  const rows = await withPrismaRetry((prisma) =>
    prisma.project.findMany({
      where: { companyId: company.id },
      include: PROJECT_INCLUDE,
      orderBy: { updatedAt: "desc" },
    }),
  );

  return (rows as PrismaProjectRow[]).map(mapProject);
}

/**
 * Advance to the next incomplete stage-gate: complete current milestone,
 * move currentStage forward, and update TRL for INTERNAL_RD.
 */
export async function advanceStageGate(
  projectId: string,
): Promise<StageGateProject> {
  const project = await withPrismaRetry((prisma) =>
    prisma.project.findUnique({
      where: { id: projectId },
      include: PROJECT_INCLUDE,
    }),
  );

  if (!project) {
    throw new Error("Project not found");
  }

  const milestones = [...project.milestones].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
  const incompleteIndex = milestones.findIndex((m) => !m.isCompleted);

  if (incompleteIndex < 0) {
    return mapProject(project as PrismaProjectRow);
  }

  const toComplete = milestones[incompleteIndex]!;
  const next = milestones[incompleteIndex + 1];
  const now = new Date();

  const qualityGate = await verifyGateQualityPass(
    projectId,
    toComplete.stage,
  );
  if (!qualityGate.canAdvance) {
    const ncrTitles = qualityGate.blockingNCRs
      .map((ncr) => ncr.title)
      .join("; ");
    throw new Error(
      `Cannot advance: open NCR(s) block stage "${toComplete.stage}"${ncrTitles ? ` — ${ncrTitles}` : ""}`,
    );
  }

  const gates = templateForType(project.projectType as ExecutionProjectType);
  const nextTrl =
    project.projectType === "INTERNAL_RD"
      ? (next
          ? (gates.find((g) => g.stage === next.stage)?.trlLevel ??
            project.trlLevel)
          : 9)
      : null;

  const updated = await withPrismaRetry((prisma) =>
    prisma.$transaction(async (tx) => {
      await tx.projectMilestone.update({
        where: { id: toComplete.id },
        data: { isCompleted: true, completedAt: now },
      });

      return tx.project.update({
        where: { id: projectId },
        data: {
          currentStage: next?.stage ?? toComplete.stage,
          ...(project.projectType === "INTERNAL_RD"
            ? { trlLevel: nextTrl }
            : {}),
          healthStatus: next ? project.healthStatus : "ON_TRACK",
        },
        include: PROJECT_INCLUDE,
      });
    }),
  );

  return mapProject(updated as PrismaProjectRow);
}
