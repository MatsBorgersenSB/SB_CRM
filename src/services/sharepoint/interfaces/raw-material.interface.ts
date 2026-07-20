import type {
  CreateRawMaterialInput,
  RawMaterial,
  RawMaterialMetrics,
  UpdateRawMaterialInput,
} from "@/types/raw-material";
import type { ISharePointEntityService } from "@/services/sharepoint/interfaces/common.interface";

export interface IRawMaterialsService
  extends ISharePointEntityService<
    RawMaterial,
    CreateRawMaterialInput,
    UpdateRawMaterialInput
  > {
  getMetrics(): Promise<RawMaterialMetrics>;
}
