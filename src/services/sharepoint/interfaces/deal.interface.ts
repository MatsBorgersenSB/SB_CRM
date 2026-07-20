import type {
  CreateDealInput,
  CreateOpportunityInput,
  Deal,
  UpdateDealInput,
} from "@/types/deal";
import type { ISharePointEntityService } from "@/services/sharepoint/interfaces/common.interface";

export interface IDealsService
  extends ISharePointEntityService<
    Deal,
    CreateDealInput | CreateOpportunityInput,
    UpdateDealInput
  > {}
