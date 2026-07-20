import type { ICompaniesService } from "@/services/sharepoint/interfaces/company.interface";
import { BaseSharePointEntityService } from "@/services/sharepoint/services/base-entity.service";
import type { IListRepository } from "@/services/sharepoint/client/types";
import type { Company } from "@/types/company";
import type { NewCompanyInput } from "@/lib/entity-id";
import type { UpdateCompanyInput } from "@/services/sharepoint/repositories/local/local-companies.repository";

export class CompaniesService
  extends BaseSharePointEntityService<
    Company,
    NewCompanyInput,
    UpdateCompanyInput
  >
  implements ICompaniesService
{
  constructor(repository: IListRepository<Company, NewCompanyInput, UpdateCompanyInput>) {
    super(repository, undefined, "Companies");
  }
}
