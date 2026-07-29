/** Stage-Gate execution project types — safe for client components. */

export type ExecutionProjectType =
  | "TURNKEY_PLANT"
  | "SINGLE_MACHINERY"
  | "INTERNAL_RD";

export type ProjectHealthStatus = "ON_TRACK" | "AT_RISK" | "DELAYED";

export type StageGateMilestone = {
  id: string;
  title: string;
  stage: string;
  isCompleted: boolean;
  dueDate: string | null;
  completedAt: string | null;
  sortOrder: number;
  estimatedLeadDays: number | null;
  isCriticalPath: boolean;
  vendorName: string | null;
  targetDeliveryDate: string | null;
};

export type StageGateProject = {
  id: string;
  title: string;
  projectType: ExecutionProjectType;
  currentStage: string;
  trlLevel: number | null;
  companyId: string;
  opportunityId: string | null;
  healthStatus: ProjectHealthStatus;
  milestones: StageGateMilestone[];
  createdAt: string;
  updatedAt: string;
  progressPercent: number;
};

export const PROJECT_TYPE_LABELS: Record<ExecutionProjectType, string> = {
  TURNKEY_PLANT: "Turnkey Plant",
  SINGLE_MACHINERY: "Single Machinery",
  INTERNAL_RD: "Internal R&D",
};

export const HEALTH_STATUS_LABELS: Record<ProjectHealthStatus, string> = {
  ON_TRACK: "On Track",
  AT_RISK: "At Risk",
  DELAYED: "Delayed",
};

export const PROJECT_TYPE_OPTIONS: Array<{
  id: ExecutionProjectType;
  label: string;
  description: string;
}> = [
  {
    id: "TURNKEY_PLANT",
    label: "Turnkey Plant",
    description: "7 stage-gates from Basic Engineering to Commissioning",
  },
  {
    id: "SINGLE_MACHINERY",
    label: "Single Machinery",
    description: "5 stage-gates from Spec Freeze to Installation Support",
  },
  {
    id: "INTERNAL_RD",
    label: "Internal R&D",
    description: "TRL 1–9 concept through commercialization",
  },
];
