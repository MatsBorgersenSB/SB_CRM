import type { Company } from "@/types/company";
import type { NewCompanyInput } from "@/lib/entity-id";
import type { UpdateCompanyInput } from "@/services/sharepoint/repositories/local/local-companies.repository";
import type { ISharePointEntityService } from "@/services/sharepoint/interfaces/common.interface";

export interface ICompaniesService
  extends ISharePointEntityService<Company, NewCompanyInput, UpdateCompanyInput> {}
