export type CriticalStatus =
  | "stable"
  | "operational"
  | "high_temp"
  | "warning"
  | "critical"
  | "offline";

export type InventoryMetricBlock = {
  value: string;
  velocity?: string;
};

export type InventoryMetrics = {
  bioOilReserves: InventoryMetricBlock;
  biocharSilos: InventoryMetricBlock;
  unprocessedFeedstock: InventoryMetricBlock;
  globalCapacityUtilized: InventoryMetricBlock;
};

export type InventoryLedgerRow = {
  location: string;
  materialType: string;
  capacityUtilization: number;
  currentTelemetry: string;
  flowVelocity: string;
  criticalStatus: CriticalStatus;
};

export type InventoryDb = {
  metrics: InventoryMetrics;
  ledger: InventoryLedgerRow[];
};

/** Production-safe empty inventory — JSON seed telemetry is local/CI only. */
export const emptyInventory: InventoryDb = {
  metrics: {
    bioOilReserves: { value: "—" },
    biocharSilos: { value: "—" },
    unprocessedFeedstock: { value: "—" },
    globalCapacityUtilized: { value: "—" },
  },
  ledger: [],
};

export const defaultInventory: InventoryDb = {
  metrics: {
    bioOilReserves: { value: "142,400 L", velocity: "+3.4%/hr" },
    biocharSilos: { value: "84.2 metric tons", velocity: "Stabilized" },
    unprocessedFeedstock: {
      value: "310 metric tons",
      velocity: "-1.2 metric tons/hr",
    },
    globalCapacityUtilized: { value: "72.5%" },
  },
  ledger: [
    {
      location: "Silo 1A",
      materialType: "High-Grade Biochar",
      capacityUtilization: 78,
      currentTelemetry: "Ambient",
      flowVelocity: "Stabilized",
      criticalStatus: "stable",
    },
    {
      location: "Silo 2B",
      materialType: "High-Grade Biochar",
      capacityUtilization: 92,
      currentTelemetry: "Ambient",
      flowVelocity: "+180 kg/h",
      criticalStatus: "operational",
    },
    {
      location: "Tank Room 4",
      materialType: "Pyrolysis Oil",
      capacityUtilization: 86,
      currentTelemetry: "180°C",
      flowVelocity: "+240 kg/h",
      criticalStatus: "stable",
    },
    {
      location: "Tank Room 5",
      materialType: "Pyrolysis Oil",
      capacityUtilization: 91,
      currentTelemetry: "176°C",
      flowVelocity: "Stabilized",
      criticalStatus: "operational",
    },
    {
      location: "Bunker C",
      materialType: "Mixed HDPE Flakes",
      capacityUtilization: 64,
      currentTelemetry: "12% Moisture",
      flowVelocity: "-420 kg/h",
      criticalStatus: "warning",
    },
    {
      location: "Chip Vault B",
      materialType: "Mixed HDPE Flakes",
      capacityUtilization: 71,
      currentTelemetry: "Ambient",
      flowVelocity: "-1,100 kg/h",
      criticalStatus: "warning",
    },
    {
      location: "Chip Vault C",
      materialType: "PET Flake Stream",
      capacityUtilization: 55,
      currentTelemetry: "Ambient",
      flowVelocity: "+95 kg/h",
      criticalStatus: "stable",
    },
    {
      location: "Feed Bay 3",
      materialType: "Mixed Plastics",
      capacityUtilization: 83,
      currentTelemetry: "Ambient",
      flowVelocity: "-680 kg/h",
      criticalStatus: "operational",
    },
    {
      location: "Cold Store 1",
      materialType: "Textile Stream",
      capacityUtilization: 48,
      currentTelemetry: "12°C",
      flowVelocity: "Stabilized",
      criticalStatus: "stable",
    },
    {
      location: "Tank Room 2",
      materialType: "Pyrolysis Oil",
      capacityUtilization: 94,
      currentTelemetry: "192°C",
      flowVelocity: "+310 kg/h",
      criticalStatus: "high_temp",
    },
    {
      location: "Silo 3C",
      materialType: "High-Grade Biochar",
      capacityUtilization: 67,
      currentTelemetry: "Ambient",
      flowVelocity: "+140 kg/h",
      criticalStatus: "operational",
    },
    {
      location: "Tank Room 1",
      materialType: "Pyrolysis Oil",
      capacityUtilization: 0,
      currentTelemetry: "—",
      flowVelocity: "0 kg/h",
      criticalStatus: "critical",
    },
  ],
};
