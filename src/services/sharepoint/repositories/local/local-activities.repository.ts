import { paginateArray } from "@/services/sharepoint/client/pagination";
import { SharePointServiceError } from "@/services/sharepoint/client/errors";
import type { IListRepository } from "@/services/sharepoint/client/types";
import type { Activity, CreateActivityInput, UpdateActivityInput } from "@/types/activity";
import {
  createActivityRecord,
  getActivity,
  listActivities,
  updateActivityRecord,
} from "@/lib/activity-store";

/** Activities read and write through the single activity store (Prisma; JSON locally). */
export class LocalActivitiesRepository
  implements IListRepository<Activity, CreateActivityInput, UpdateActivityInput>
{
  async list(page?: Parameters<typeof paginateArray>[1]) {
    return paginateArray(await listActivities(), page);
  }

  async getById(id: string | number): Promise<Activity> {
    const activity = await getActivity(id);
    if (!activity) throw SharePointServiceError.notFound("Activity", id);
    return activity;
  }

  async create(input: CreateActivityInput): Promise<Activity> {
    return createActivityRecord(input);
  }

  async update(id: string | number, patch: UpdateActivityInput): Promise<Activity> {
    return updateActivityRecord(id, patch);
  }

  async delete(): Promise<void> {
    throw SharePointServiceError.validation("Delete activity is not enabled in local transport");
  }
}
