import type { CriticalStatus } from "@/lib/inventory-data";

/** SharePoint RawMaterials list — frozen schema. */
export type RawMaterial = {
  id: number;
  MaterialID: string;
  Title: string;
  Location: string;
  MaterialType: string;
  CapacityUtilization: number;
  CurrentTelemetry: string;
  FlowVelocity: string;
  CriticalStatus: CriticalStatus;
};

export type RawMaterialMetrics = {
  bioOilReserves: { value: string; velocity?: string };
  biocharSilos: { value: string; velocity?: string };
  unprocessedFeedstock: { value: string; velocity?: string };
  globalCapacityUtilized: { value: string; velocity?: string };
};

export type CreateRawMaterialInput = Omit<RawMaterial, "id" | "MaterialID"> & {
  MaterialID?: string;
};

export type UpdateRawMaterialInput = Partial<
  Omit<RawMaterial, "id" | "MaterialID">
>;
