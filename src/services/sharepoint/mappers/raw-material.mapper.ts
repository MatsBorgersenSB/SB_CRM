import type { RawMaterial } from "@/types/raw-material";
import type { CriticalStatus } from "@/lib/inventory-data";
import type { GraphListItem, ListItemMapper } from "@/services/sharepoint/client/types";

type RawMaterialFields = {
  MaterialID: string;
  Title: string;
  Location: string;
  MaterialType: string;
  CapacityUtilization: number;
  CurrentTelemetry: string;
  FlowVelocity: string;
  CriticalStatus: string;
};

export const rawMaterialMapper: ListItemMapper<
  RawMaterialFields,
  RawMaterial
> = {
  toDomain(item: GraphListItem<RawMaterialFields>): RawMaterial {
    const fields = item.fields;
    return {
      id: Number(item.id),
      MaterialID: fields.MaterialID,
      Title: fields.Title,
      Location: fields.Location,
      MaterialType: fields.MaterialType,
      CapacityUtilization: fields.CapacityUtilization ?? 0,
      CurrentTelemetry: fields.CurrentTelemetry ?? "",
      FlowVelocity: fields.FlowVelocity ?? "",
      CriticalStatus: fields.CriticalStatus as CriticalStatus,
    };
  },

  toFields(input: Partial<RawMaterial>): Record<string, unknown> {
    const fields: Record<string, unknown> = {};
    if (input.MaterialID !== undefined) fields.MaterialID = input.MaterialID;
    if (input.Title !== undefined) fields.Title = input.Title;
    if (input.Location !== undefined) fields.Location = input.Location;
    if (input.MaterialType !== undefined) fields.MaterialType = input.MaterialType;
    if (input.CapacityUtilization !== undefined) {
      fields.CapacityUtilization = input.CapacityUtilization;
    }
    if (input.CurrentTelemetry !== undefined) {
      fields.CurrentTelemetry = input.CurrentTelemetry;
    }
    if (input.FlowVelocity !== undefined) fields.FlowVelocity = input.FlowVelocity;
    if (input.CriticalStatus !== undefined) {
      fields.CriticalStatus = input.CriticalStatus;
    }
    return fields;
  },
};
