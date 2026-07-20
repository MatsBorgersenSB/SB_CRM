import type { EditablePipelineField, PipelineRow } from "@/types/pipeline";
import { buildSharePointPatch } from "@/types/pipeline";
import type { CreateOpportunityInput } from "@/types/deal";
import type { UserRole } from "@/types/auth";
import { AUTH_ROLE_HEADER } from "@/lib/api-auth";
import { toSharePointServiceError } from "@/services/sharepoint/client/errors";
import { createBrowserSharePointServices } from "@/services/sharepoint/browser";

export type SyncState = "idle" | "syncing" | "synced" | "error";

function getDealsService(role: UserRole = "superuser") {
  return createBrowserSharePointServices(role).deals;
}

export async function fetchPipelines(): Promise<PipelineRow[]> {
  try {
    const result = await getDealsService().list();
    return result.items;
  } catch (error) {
    throw toSharePointServiceError(error);
  }
}

export async function createDealRecord(
  input: CreateOpportunityInput,
  role: UserRole = "superuser",
): Promise<PipelineRow> {
  try {
    return await getDealsService(role).create(input);
  } catch (error) {
    throw toSharePointServiceError(error);
  }
}

export async function syncPipelineRecord(
  id: string,
  patch: Partial<PipelineRow>,
  role: UserRole = "superuser",
): Promise<PipelineRow> {
  try {
    return await getDealsService(role).update(id, patch);
  } catch (error) {
    throw toSharePointServiceError(error);
  }
}

export async function syncPipelineField(
  id: string,
  field: EditablePipelineField,
  value: string,
  role: UserRole = "superuser",
): Promise<void> {
  await syncPipelineRecord(id, buildSharePointPatch(field, value), role);
}

/** @internal role header preserved for API route RBAC enforcement */
export function authHeaders(role: UserRole): HeadersInit {
  return {
    "Content-Type": "application/json",
    [AUTH_ROLE_HEADER]: role,
  };
}
