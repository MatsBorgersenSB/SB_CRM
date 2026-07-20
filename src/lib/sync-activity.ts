import type { Activity, CreateActivityInput, UpdateActivityInput } from "@/types/activity";
import { toSharePointServiceError } from "@/services/sharepoint/client/errors";
import { activitiesService } from "@/services/sharepoint/browser";

export async function syncActivityCreate(input: CreateActivityInput): Promise<Activity> {
  try {
    return await activitiesService.create(input);
  } catch (error) {
    throw toSharePointServiceError(error);
  }
}

export async function syncActivityUpdate(
  activityId: string,
  patch: UpdateActivityInput,
): Promise<Activity> {
  try {
    return await activitiesService.update(activityId, patch);
  } catch (error) {
    throw toSharePointServiceError(error);
  }
}
