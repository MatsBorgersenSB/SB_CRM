import { paginateArray } from "@/services/sharepoint/client/pagination";
import { SharePointServiceError } from "@/services/sharepoint/client/errors";
import type { IListRepository } from "@/services/sharepoint/client/types";
import type {
  CreateDealInput,
  CreateOpportunityInput,
  Deal,
  UpdateDealInput,
} from "@/types/deal";
import { createPipeline, readPipelines } from "@/lib/pipeline-db";
import { updatePipelineWithCommercialHooks } from "@/lib/commercial-package-actions";
import {
  createRegistryOpportunity,
  getRegistryOpportunity,
  listRegistryOpportunities,
  updateRegistryOpportunity,
} from "@/lib/opportunity-registry";
import { readLivePipelines } from "@/lib/prisma-data";
import { COMPANY_ROLES } from "@/types/pipeline";

function isCreateOpportunityInput(
  input: CreateDealInput | CreateOpportunityInput,
): input is CreateOpportunityInput {
  return (
    typeof (input as CreateOpportunityInput).companyId === "string" &&
    typeof (input as CreateOpportunityInput).assetName === "string" &&
    typeof (input as CreateOpportunityInput).companyRole === "string" &&
    Array.isArray((input as CreateOpportunityInput).offeringIds)
  );
}

export class LocalDealsRepository
  implements IListRepository<Deal, CreateDealInput | CreateOpportunityInput, UpdateDealInput>
{
  async list(page?: Parameters<typeof paginateArray>[1]) {
    try {
      const fromRegistry = await listRegistryOpportunities();
      if (fromRegistry) return paginateArray(fromRegistry, page);
      const live = await readLivePipelines();
      return paginateArray(live, page);
    } catch {
      const deals = await readPipelines();
      return paginateArray(deals, page);
    }
  }

  async getById(id: string | number): Promise<Deal> {
    const fromRegistry = await getRegistryOpportunity(String(id));
    if (fromRegistry) return fromRegistry;

    const deals = await readPipelines();
    const deal = deals.find((row) => row.id === String(id));
    if (!deal) throw SharePointServiceError.notFound("Deal", id);
    return deal;
  }

  async create(input: CreateDealInput | CreateOpportunityInput): Promise<Deal> {
    if (isCreateOpportunityInput(input)) {
      if (!COMPANY_ROLES.includes(input.companyRole)) {
        throw SharePointServiceError.validation("Invalid opportunity type");
      }
      if (!input.offeringIds?.length) {
        throw SharePointServiceError.validation(
          "Select at least one Standard Bio offering",
        );
      }

      const created = await createRegistryOpportunity(input);
      if (created) return created;

      try {
        return await createPipeline(input);
      } catch (error) {
        throw SharePointServiceError.validation(
          error instanceof Error ? error.message : "Could not create opportunity",
        );
      }
    }

    throw SharePointServiceError.validation(
      "Opportunity creation requires companyId, assetName, companyRole, and offeringIds",
    );
  }

  async update(id: string | number, patch: UpdateDealInput): Promise<Deal> {
    const updated = await updateRegistryOpportunity(String(id), patch);
    if (updated) return updated;
    return updatePipelineWithCommercialHooks(String(id), patch);
  }

  async delete(): Promise<void> {
    throw SharePointServiceError.validation(
      "Delete deal is not enabled in local transport",
    );
  }
}
