import { HttpSharePointEntityService } from "@/services/sharepoint/browser/http-entity.service";
import { readResponseBody } from "@/services/sharepoint/client/response-body";
import { SharePointServiceError } from "@/services/sharepoint/client/errors";
import type { ICompaniesService } from "@/services/sharepoint/interfaces/company.interface";
import type { IContactsService } from "@/services/sharepoint/interfaces/contact.interface";
import type { IDealsService } from "@/services/sharepoint/interfaces/deal.interface";
import type { IRawMaterialsService } from "@/services/sharepoint/interfaces/raw-material.interface";
import type { Company } from "@/types/company";
import type { NewCompanyInput } from "@/lib/entity-id";
import type { UpdateCompanyInput } from "@/services/sharepoint/repositories/local/local-companies.repository";
import type { Contact, CreateContactInput, UpdateContactInput } from "@/types/contact";
import type { CreateDealInput, CreateOpportunityInput, Deal, UpdateDealInput } from "@/types/deal";
import type {
  CreateRawMaterialInput,
  RawMaterial,
  RawMaterialMetrics,
  UpdateRawMaterialInput,
} from "@/types/raw-material";
import type { Activity, CreateActivityInput, UpdateActivityInput } from "@/types/activity";
import type { UserRole } from "@/types/auth";
import { AUTH_ROLE_HEADER } from "@/lib/api-auth";

class BrowserDealsService
  extends HttpSharePointEntityService<
    Deal,
    CreateDealInput | CreateOpportunityInput,
    UpdateDealInput
  >
  implements IDealsService
{
  constructor(role: UserRole = "superuser") {
    super("/api/deals", role);
  }

  override async update(id: string | number, patch: UpdateDealInput): Promise<Deal> {
    const response = await fetch(`/api/deals/${encodeURIComponent(String(id))}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        [AUTH_ROLE_HEADER]: this.role,
      },
      body: JSON.stringify(patch),
    });
    const body = await readResponseBody(response);
    if (!response.ok) {
      throw SharePointServiceError.fromResponse(response, body);
    }
    return body as Deal;
  }
}

class BrowserRawMaterialsService
  extends HttpSharePointEntityService<
    RawMaterial,
    CreateRawMaterialInput,
    UpdateRawMaterialInput
  >
  implements IRawMaterialsService
{
  constructor() {
    super("/api/raw-materials");
  }

  async getMetrics(): Promise<RawMaterialMetrics> {
    const response = await fetch("/api/raw-materials/metrics");
    if (!response.ok) throw new Error("Failed to load raw material metrics");
    return response.json();
  }
}

class BrowserContactsService
  extends HttpSharePointEntityService<
    Contact,
    CreateContactInput,
    UpdateContactInput
  >
  implements IContactsService
{
  constructor(private readonly companyScoped = false) {
    super("/api/contacts");
  }

  async createForCompany(
    companyId: string,
    input: CreateContactInput,
  ): Promise<Contact> {
    const response = await fetch(
      `/api/companies/${encodeURIComponent(companyId)}/contacts`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
    );
    if (!response.ok) throw new Error("Contact creation failed");
    return response.json();
  }
}

export type BrowserSharePointServices = {
  companies: ICompaniesService;
  contacts: BrowserContactsService;
  deals: BrowserDealsService;
  rawMaterials: IRawMaterialsService;
  activities: HttpSharePointEntityService<
    Activity,
    CreateActivityInput,
    UpdateActivityInput
  >;
};

export function createBrowserSharePointServices(
  role: UserRole = "superuser",
): BrowserSharePointServices {
  return {
    companies: new HttpSharePointEntityService<
      Company,
      NewCompanyInput,
      UpdateCompanyInput
    >("/api/companies", role),
    contacts: new BrowserContactsService(),
    deals: new BrowserDealsService(role),
    rawMaterials: new BrowserRawMaterialsService(),
    activities: new HttpSharePointEntityService<
      Activity,
      CreateActivityInput,
      UpdateActivityInput
    >("/api/activities", role),
  };
}

export const sharePointServices = createBrowserSharePointServices();

export const companiesService = sharePointServices.companies;
export const contactsService = sharePointServices.contacts;
export const dealsService = sharePointServices.deals;
export const rawMaterialsService = sharePointServices.rawMaterials;
export const activitiesService = sharePointServices.activities;

export function getCompaniesService(role: UserRole = "superuser") {
  return createBrowserSharePointServices(role).companies;
}
