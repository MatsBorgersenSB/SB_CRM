import type { IActivitiesService } from "@/services/sharepoint/interfaces/activity.interface";
import { BaseSharePointEntityService } from "@/services/sharepoint/services/base-entity.service";
import type { IListRepository } from "@/services/sharepoint/client/types";
import type { Activity, CreateActivityInput, UpdateActivityInput } from "@/types/activity";

export class ActivitiesService
  extends BaseSharePointEntityService<
    Activity,
    CreateActivityInput,
    UpdateActivityInput
  >
  implements IActivitiesService
{
  constructor(
    repository: IListRepository<Activity, CreateActivityInput, UpdateActivityInput>,
  ) {
    super(repository, undefined, "Activities");
  }
}
