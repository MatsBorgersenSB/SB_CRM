import { paginateArray } from "@/services/sharepoint/client/pagination";
import type { PageRequest, PageResult } from "@/services/sharepoint/client/pagination";
import { SharePointServiceError } from "@/services/sharepoint/client/errors";
import type { IListRepository } from "@/services/sharepoint/client/types";
import type { Company } from "@/types/company";
import type { NewCompanyInput } from "@/lib/entity-id";
import {
  COMPANY_DELETE_BLOCKED_MESSAGE,
  getCompanyDeletionBlockers,
  isCompanyDeletable,
} from "@/lib/company-deletion";
import {
  createRegistryCompany,
  deleteRegistryCompany,
  getRegistryCompanyById,
  updateRegistryCompany,
} from "@/lib/company-registry";
import {
  createCompany,
  deleteCompany,
  readCompanies,
  readDatabase,
  updateCompany,
} from "@/lib/pipeline-db";
import { readLiveCompanies, shouldFallbackToJsonPortfolio } from "@/lib/prisma-data";

export type UpdateCompanyInput = Partial<
  Omit<Company, "id" | "CompanyID" | "pipelineIds" | "contacts">
>;

export class LocalCompaniesRepository
  implements IListRepository<Company, NewCompanyInput, UpdateCompanyInput>
{
  async list(page?: PageRequest): Promise<PageResult<Company>> {
    try {
      const companies = await readLiveCompanies();
      return paginateArray(companies, page);
    } catch (error) {
      if (!shouldFallbackToJsonPortfolio()) throw error;
      const companies = await readCompanies();
      return paginateArray(companies, page);
    }
  }

  async getById(id: string | number): Promise<Company> {
    const fromRegistry = await getRegistryCompanyById(id);
    if (fromRegistry) return fromRegistry;

    if (!shouldFallbackToJsonPortfolio()) {
      throw SharePointServiceError.notFound("Company", id);
    }

    const companies = await readCompanies();
    const company = companies.find(
      (row) => row.id === Number(id) || row.CompanyID === String(id),
    );
    if (!company) throw SharePointServiceError.notFound("Company", id);
    return company;
  }

  async create(input: NewCompanyInput): Promise<Company> {
    const created = await createRegistryCompany(input);
    if (created) return created;
    return createCompany(input);
  }

  async update(id: string | number, patch: UpdateCompanyInput): Promise<Company> {
    const updated = await updateRegistryCompany(id, patch);
    if (updated) return updated;

    // JSON fallback (local /tmp on Vercel). May 404 if the company only exists in Prisma
    // and Prisma was temporarily unavailable above.
    try {
      const current = await this.getById(id);
      return await updateCompany(current.CompanyID, patch);
    } catch (error) {
      if (error instanceof SharePointServiceError) throw error;
      throw SharePointServiceError.notFound("Company", id);
    }
  }

  async delete(id: string | number): Promise<void> {
    if (await deleteRegistryCompany(id)) return;

    const current = await this.getById(id);
    const database = await readDatabase();
    const blockers = getCompanyDeletionBlockers(
      current,
      database.pipelines,
      database.activities,
    );

    if (!isCompanyDeletable(blockers)) {
      throw SharePointServiceError.conflict(COMPANY_DELETE_BLOCKED_MESSAGE, blockers);
    }

    await deleteCompany(current.CompanyID);
  }
}
