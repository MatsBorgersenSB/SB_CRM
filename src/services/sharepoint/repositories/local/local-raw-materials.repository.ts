import { paginateArray } from "@/services/sharepoint/client/pagination";
import { SharePointServiceError } from "@/services/sharepoint/client/errors";
import type { IListRepository } from "@/services/sharepoint/client/types";
import type {
  CreateRawMaterialInput,
  RawMaterial,
  UpdateRawMaterialInput,
} from "@/types/raw-material";
import { readInventory } from "@/lib/pipeline-db";

function ledgerToRawMaterial(
  row: {
    location: string;
    materialType: string;
    capacityUtilization: number;
    currentTelemetry: string;
    flowVelocity: string;
    criticalStatus: RawMaterial["CriticalStatus"];
  },
  index: number,
): RawMaterial {
  return {
    id: index + 1,
    MaterialID: `RM-${1000 + index}`,
    Title: row.materialType,
    Location: row.location,
    MaterialType: row.materialType,
    CapacityUtilization: row.capacityUtilization,
    CurrentTelemetry: row.currentTelemetry,
    FlowVelocity: row.flowVelocity,
    CriticalStatus: row.criticalStatus,
  };
}

export class LocalRawMaterialsRepository
  implements
    IListRepository<RawMaterial, CreateRawMaterialInput, UpdateRawMaterialInput>
{
  private async all(): Promise<RawMaterial[]> {
    const inventory = await readInventory();
    return inventory.ledger.map(ledgerToRawMaterial);
  }

  async list(page?: Parameters<typeof paginateArray>[1]) {
    return paginateArray(await this.all(), page);
  }

  async getById(id: string | number): Promise<RawMaterial> {
    const materials = await this.all();
    const material = materials.find(
      (row) => row.id === Number(id) || row.MaterialID === String(id),
    );
    if (!material) throw SharePointServiceError.notFound("RawMaterial", id);
    return material;
  }

  async create(): Promise<RawMaterial> {
    throw SharePointServiceError.validation(
      "Create raw material is not enabled in local transport",
    );
  }

  async update(
    id: string | number,
    patch: UpdateRawMaterialInput,
  ): Promise<RawMaterial> {
    const current = await this.getById(id);
    return { ...current, ...patch };
  }

  async delete(): Promise<void> {
    throw SharePointServiceError.validation(
      "Delete raw material is not enabled in local transport",
    );
  }

  async getMetrics() {
    const inventory = await readInventory();
    return inventory.metrics;
  }
}
