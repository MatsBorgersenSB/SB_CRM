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
  createCompany,
  deleteCompany,
  readCompanies,
  readDatabase,
  updateCompany,
} from "@/lib/pipeline-db";

export type UpdateCompanyInput = Partial<
  Omit<Company, "id" | "CompanyID" | "pipelineIds" | "contacts">
>;

export class LocalCompaniesRepository
  implements IListRepository<Company, NewCompanyInput, UpdateCompanyInput>
{
  async list(page?: PageRequest): Promise<PageResult<Company>> {
    const companies = await readCompanies();
    return paginateArray(companies, page);
  }

  async getById(id: string | number): Promise<Company> {
    const companies = await readCompanies();
    const company = companies.find(
      (row) => row.id === Number(id) || row.CompanyID === String(id),
    );
    if (!company) throw SharePointServiceError.notFound("Company", id);
    return company;
  }

  async create(input: NewCompanyInput): Promise<Company> {
    return createCompany(input);
  }

  async update(id: string | number, patch: UpdateCompanyInput): Promise<Company> {
    const current = await this.getById(id);
    return updateCompany(current.CompanyID, patch);
  }

  async delete(id: string | number): Promise<void> {
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
