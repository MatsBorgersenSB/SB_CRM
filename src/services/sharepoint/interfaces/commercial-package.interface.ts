import type { ISharePointEntityService } from "@/services/sharepoint/interfaces/common.interface";
import type { CommercialPackage } from "@/types/commercial-package";
import type {
  CreateCommercialPackageInput,
  UpdateCommercialPackageInput,
} from "@/types/commercial-package-input";

export interface ICommercialPackagesService
  extends ISharePointEntityService<
    CommercialPackage,
    CreateCommercialPackageInput,
    UpdateCommercialPackageInput
  > {
  listForDeal(dealId: string): Promise<CommercialPackage[]>;
}
