import type { IDealsService } from "@/services/sharepoint/interfaces/deal.interface";
import { BaseSharePointEntityService } from "@/services/sharepoint/services/base-entity.service";
import type { IListRepository } from "@/services/sharepoint/client/types";
import type {
  CreateDealInput,
  CreateOpportunityInput,
  Deal,
  UpdateDealInput,
} from "@/types/deal";

export class DealsService
  extends BaseSharePointEntityService<
    Deal,
    CreateDealInput | CreateOpportunityInput,
    UpdateDealInput
  >
  implements IDealsService
{
  constructor(
    repository: IListRepository<
      Deal,
      CreateDealInput | CreateOpportunityInput,
      UpdateDealInput
    >,
  ) {
    super(repository, undefined, "Deals");
  }
}
