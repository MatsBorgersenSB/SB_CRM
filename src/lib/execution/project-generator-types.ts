/** Stage-Gate execution project types — safe for client components. */

export type ExecutionProjectType =
  | "TURNKEY_PLANT"
  | "SINGLE_MACHINERY"
  | "INTERNAL_RD";

export type ProjectHealthStatus =
  | "ON_TRACK"
  | "AT_RISK"
  | "DELAYED"
  | "IN_DISPUTE";

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
  IN_DISPUTE: "In Dispute",
};

/** Labels for mid-flight import health selector. */
export const HEALTH_STATUS_OPTIONS: Array<{
  id: ProjectHealthStatus;
  label: string;
}> = [
  { id: "ON_TRACK", label: "On Track 🟢" },
  { id: "AT_RISK", label: "At Risk ⚠️" },
  { id: "DELAYED", label: "Delayed 🔴" },
  { id: "IN_DISPUTE", label: "In Dispute ⚖️" },
];

export type StageGateTemplateOption = {
  index: number;
  title: string;
  stage: string;
  /** Starting TRL for INTERNAL_RD stages */
  trlLevel?: number;
};

/** Fixed stage lists for generator UI (must stay aligned with server templates). */
export const STAGE_GATE_TEMPLATE_OPTIONS: Record<
  ExecutionProjectType,
  StageGateTemplateOption[]
> = {
  TURNKEY_PLANT: [
    { index: 0, title: "Basic Engineering", stage: "1. Basic Engineering" },
    { index: 1, title: "Detail Engineering", stage: "2. Detail Engineering" },
    { index: 2, title: "Procurement", stage: "3. Procurement" },
    { index: 3, title: "Fabrication & Assembly", stage: "4. Fabrication & Assembly" },
    { index: 4, title: "FAT Testing", stage: "5. FAT Testing" },
    { index: 5, title: "Site Delivery & SAT", stage: "6. Site Delivery & SAT" },
    { index: 6, title: "Commissioning & Handover", stage: "7. Commissioning & Handover" },
  ],
  SINGLE_MACHINERY: [
    { index: 0, title: "Spec Freeze", stage: "1. Spec Freeze" },
    { index: 1, title: "Component Procurement", stage: "2. Component Procurement" },
    { index: 2, title: "Assembly & FAT", stage: "3. Assembly & FAT" },
    { index: 3, title: "Shipping & Logistics", stage: "4. Shipping & Logistics" },
    { index: 4, title: "Installation Support", stage: "5. Installation Support" },
  ],
  INTERNAL_RD: [
    {
      index: 0,
      title: "Concept & Feasibility",
      stage: "TRL 1–3 Concept & Feasibility",
      trlLevel: 1,
    },
    {
      index: 1,
      title: "Lab / Pilot Prototyping",
      stage: "TRL 4–6 Lab/Pilot Prototyping",
      trlLevel: 4,
    },
    {
      index: 2,
      title: "Field Testing",
      stage: "TRL 7–8 Field Testing",
      trlLevel: 7,
    },
    {
      index: 3,
      title: "Commercialization",
      stage: "TRL 9 Commercialization",
      trlLevel: 9,
    },
  ],
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
