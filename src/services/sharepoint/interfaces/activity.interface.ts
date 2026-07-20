import type { ISharePointEntityService } from "@/services/sharepoint/interfaces/common.interface";
import type { Activity, CreateActivityInput, UpdateActivityInput } from "@/types/activity";

export interface IActivitiesService
  extends ISharePointEntityService<
    Activity,
    CreateActivityInput,
    UpdateActivityInput
  > {}
