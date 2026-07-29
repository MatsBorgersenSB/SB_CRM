/** ATEX ESD & PLC/SCADA types — safe for client components. */

export type AtexZone = "ZONE_0" | "ZONE_1" | "ZONE_2" | "SAFE_AREA";

export type AtexInterlockRecord = {
  id: string;
  projectId: string;
  loopName: string;
  atexZone: AtexZone;
  causeDescription: string;
  effectDescription: string;
  isDryTested: boolean;
  isWetTested: boolean;
  verifiedBy: string | null;
  verifiedAt: string | null;
  createdAt: string;
};

export type PlcReleaseRecord = {
  id: string;
  projectId: string;
  plcTargetName: string;
  codeVersion: string;
  backupChecksum: string | null;
  notes: string | null;
  totalLoopsCount: number;
  verifiedLoopsCount: number;
  deployedBy: string | null;
  createdAt: string;
  loopVerifiedPercent: number;
};

export type SafetyInterlockCheck = {
  safeToAdvance: boolean;
  unverifiedInterlocks: AtexInterlockRecord[];
};

export type AtexPlcSummary = {
  projectId: string;
  projectTitle: string;
  interlocks: AtexInterlockRecord[];
  safetyCheck: SafetyInterlockCheck;
  latestPlcRelease: PlcReleaseRecord | null;
  plcReleases: PlcReleaseRecord[];
};

export const ATEX_ZONE_LABELS: Record<AtexZone, string> = {
  ZONE_0: "Zone 0",
  ZONE_1: "Zone 1",
  ZONE_2: "Zone 2",
  SAFE_AREA: "Safe Area",
};

export const ATEX_ZONE_OPTIONS: Array<{ id: AtexZone; label: string }> = [
  { id: "ZONE_0", label: "Zone 0" },
  { id: "ZONE_1", label: "Zone 1" },
  { id: "ZONE_2", label: "Zone 2" },
  { id: "SAFE_AREA", label: "Safe Area" },
];

/** Zones that must be dry-tested before hot gas / hot commissioning. */
export const HOT_GAS_CRITICAL_ZONES: AtexZone[] = ["ZONE_1", "ZONE_2"];
