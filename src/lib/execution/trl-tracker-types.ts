/** TRL & Internal R&D Tracker types — safe for client components. */

export type IpFilingStatus =
  | "NONE"
  | "PROVISIONAL_FILED"
  | "PATENT_GRANTED"
  | "TRADE_SECRET";

export type RdExperimentLogRecord = {
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
  createdAt: string;
};

export type TrlProgressionSummary = {
  projectId: string;
  projectTitle: string;
  projectType: string;
  currentTrlLevel: number | null;
  experiments: RdExperimentLogRecord[];
  maxLoggedTrl: number | null;
  ipHighlights: IpFilingStatus[];
};

export const IP_FILING_STATUS_LABELS: Record<IpFilingStatus, string> = {
  NONE: "No IP filing",
  PROVISIONAL_FILED: "Provisional Filed",
  PATENT_GRANTED: "Patent Granted",
  TRADE_SECRET: "Trade Secret",
};

export const IP_FILING_STATUS_OPTIONS: Array<{
  id: IpFilingStatus;
  label: string;
}> = [
  { id: "NONE", label: "None" },
  { id: "PROVISIONAL_FILED", label: "Provisional Filed" },
  { id: "PATENT_GRANTED", label: "Patent Granted" },
  { id: "TRADE_SECRET", label: "Trade Secret" },
];

export const FEEDSTOCK_SUGGESTIONS = [
  "Wood Chips",
  "Sewage Sludge",
  "Agricultural Residue",
  "Mixed Plastics",
  "RDF / SRF",
  "Biosolids",
] as const;

export const TRL_LADDER: Array<{ level: number; label: string }> = [
  { level: 1, label: "Basic principles" },
  { level: 2, label: "Technology concept" },
  { level: 3, label: "Proof of concept" },
  { level: 4, label: "Lab validation" },
  { level: 5, label: "Relevant env. validation" },
  { level: 6, label: "Prototype demonstration" },
  { level: 7, label: "System prototype" },
  { level: 8, label: "System complete" },
  { level: 9, label: "Actual system proven" },
];
