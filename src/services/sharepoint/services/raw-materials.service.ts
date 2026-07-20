import type { IRawMaterialsService } from "@/services/sharepoint/interfaces/raw-material.interface";
import { BaseSharePointEntityService } from "@/services/sharepoint/services/base-entity.service";
import type { IListRepository } from "@/services/sharepoint/client/types";
import type {
  CreateRawMaterialInput,
  RawMaterial,
  RawMaterialMetrics,
  UpdateRawMaterialInput,
} from "@/types/raw-material";
import type { LocalRawMaterialsRepository } from "@/services/sharepoint/repositories/local/local-raw-materials.repository";

export class RawMaterialsService
  extends BaseSharePointEntityService<
    RawMaterial,
    CreateRawMaterialInput,
    UpdateRawMaterialInput
  >
  implements IRawMaterialsService
{
  constructor(
    repository: IListRepository<
      RawMaterial,
      CreateRawMaterialInput,
      UpdateRawMaterialInput
    >,
  ) {
    super(repository, undefined, "RawMaterials");
  }

  async getMetrics(): Promise<RawMaterialMetrics> {
    const repo = this.repository as LocalRawMaterialsRepository;
    if (typeof repo.getMetrics === "function") {
      return repo.getMetrics();
    }

    return {
      bioOilReserves: { value: "—" },
      biocharSilos: { value: "—" },
      unprocessedFeedstock: { value: "—" },
      globalCapacityUtilized: { value: "—" },
    };
  }
}
