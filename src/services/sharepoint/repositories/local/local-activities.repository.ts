import { paginateArray } from "@/services/sharepoint/client/pagination";
import { SharePointServiceError } from "@/services/sharepoint/client/errors";
import type { IListRepository } from "@/services/sharepoint/client/types";
import type { Activity, CreateActivityInput, UpdateActivityInput } from "@/types/activity";
import {
  createActivity,
  readActivities,
  updateActivity,
} from "@/lib/pipeline-db";

export class LocalActivitiesRepository
  implements IListRepository<Activity, CreateActivityInput, UpdateActivityInput>
{
  async list(page?: Parameters<typeof paginateArray>[1]) {
    return paginateArray(await readActivities(), page);
  }

  async getById(id: string | number): Promise<Activity> {
    const activities = await readActivities();
    const activity = activities.find(
      (row) => row.id === Number(id) || row.ActivityID === String(id),
    );
    if (!activity) throw SharePointServiceError.notFound("Activity", id);
    return activity;
  }

  async create(input: CreateActivityInput): Promise<Activity> {
    return createActivity(input);
  }

  async update(id: string | number, patch: UpdateActivityInput): Promise<Activity> {
    return updateActivity(String(id), patch);
  }

  async delete(): Promise<void> {
    throw SharePointServiceError.validation(
      "Delete activity is not enabled in local transport",
    );
  }
}
