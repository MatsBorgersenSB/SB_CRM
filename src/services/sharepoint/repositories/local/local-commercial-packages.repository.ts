import { paginateArray } from "@/services/sharepoint/client/pagination";
import { SharePointServiceError } from "@/services/sharepoint/client/errors";
import type { IListRepository } from "@/services/sharepoint/client/types";
import type { CommercialPackage } from "@/types/commercial-package";
import type {
  CreateCommercialPackageInput,
  UpdateCommercialPackageInput,
} from "@/types/commercial-package-input";
import {
  createCommercialPackage,
  readCommercialPackages,
  updateCommercialPackage,
} from "@/lib/pipeline-db";

export class LocalCommercialPackagesRepository
  implements
    IListRepository<
      CommercialPackage,
      CreateCommercialPackageInput,
      UpdateCommercialPackageInput
    >
{
  async list(page?: Parameters<typeof paginateArray>[1]) {
    return paginateArray(await readCommercialPackages(), page);
  }

  async getById(id: string | number): Promise<CommercialPackage> {
    const packages = await readCommercialPackages();
    const record = packages.find(
      (row) => row.id === Number(id) || row.PackageID === String(id),
    );
    if (!record) throw SharePointServiceError.notFound("CommercialPackage", id);
    return record;
  }

  async create(input: CreateCommercialPackageInput): Promise<CommercialPackage> {
    return createCommercialPackage(input);
  }

  async update(
    id: string | number,
    patch: UpdateCommercialPackageInput,
  ): Promise<CommercialPackage> {
    return updateCommercialPackage(String(id), patch);
  }

  async delete(): Promise<void> {
    throw SharePointServiceError.validation(
      "Delete commercial package is not enabled in local transport",
    );
  }
}
