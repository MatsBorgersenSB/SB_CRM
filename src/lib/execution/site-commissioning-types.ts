/** Site Commissioning Co-Pilot types — safe for client components. */

export type CommissioningPhase =
  | "COLD_COMMISSIONING"
  | "HOT_COMMISSIONING"
  | "SYNGAS_TESTING"
  | "PERFORMANCE_RUN";

export type ProjectHealthStatus = "ON_TRACK" | "AT_RISK" | "DELAYED";

export type CommissioningLogRecord = {
  id: string;
  projectId: string;
  phase: CommissioningPhase;
  safetyCheckPassed: boolean;
  atexZoningVerified: boolean;
  logTitle: string;
  operationalNotes: string | null;
  issuesEncountered: string | null;
  loggedBy: string | null;
  createdAt: string;
};

export type CommissioningPhaseStatus = {
  phase: CommissioningPhase;
  label: string;
  logCount: number;
  lastLogAt: string | null;
  safetyEverPassed: boolean;
  atexEverVerified: boolean;
};

export type CommissioningSummary = {
  projectId: string;
  projectTitle: string;
  projectHealthStatus: ProjectHealthStatus;
  logs: CommissioningLogRecord[];
  phases: CommissioningPhaseStatus[];
  atexVerified: boolean;
  syngasEsdTested: boolean;
  thermalLimitsOk: boolean;
  openSafetyItemCount: number;
};

export const COMMISSIONING_PHASE_LABELS: Record<CommissioningPhase, string> = {
  COLD_COMMISSIONING: "Cold Commissioning",
  HOT_COMMISSIONING: "Hot Commissioning",
  SYNGAS_TESTING: "Syngas Testing",
  PERFORMANCE_RUN: "Performance Run",
};

export const COMMISSIONING_PHASE_OPTIONS: Array<{
  id: CommissioningPhase;
  label: string;
}> = [
  { id: "COLD_COMMISSIONING", label: "Cold Commissioning" },
  { id: "HOT_COMMISSIONING", label: "Hot Commissioning" },
  { id: "SYNGAS_TESTING", label: "Syngas Testing" },
  { id: "PERFORMANCE_RUN", label: "Performance Run" },
];
