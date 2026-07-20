import type { ICommercialPackagesService } from "@/services/sharepoint/interfaces/commercial-package.interface";
import { BaseSharePointEntityService } from "@/services/sharepoint/services/base-entity.service";
import type { IListRepository } from "@/services/sharepoint/client/types";
import type { CommercialPackage } from "@/types/commercial-package";
import type {
  CreateCommercialPackageInput,
  UpdateCommercialPackageInput,
} from "@/types/commercial-package-input";
import { readCommercialPackagesForDeal } from "@/lib/pipeline-db";

export class CommercialPackagesService
  extends BaseSharePointEntityService<
    CommercialPackage,
    CreateCommercialPackageInput,
    UpdateCommercialPackageInput
  >
  implements ICommercialPackagesService
{
  constructor(
    repository: IListRepository<
      CommercialPackage,
      CreateCommercialPackageInput,
      UpdateCommercialPackageInput
    >,
  ) {
    super(repository, undefined, "CommercialPackages");
  }

  async listForDeal(dealId: string): Promise<CommercialPackage[]> {
    return readCommercialPackagesForDeal(dealId);
  }
}
