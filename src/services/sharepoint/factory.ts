import { NoOpCacheProvider } from "@/services/sharepoint/client/cache-provider";
import { GraphHttpClient } from "@/services/sharepoint/client/graph-http-client";
import { SharePointListClient } from "@/services/sharepoint/client/sharepoint-list-client";
import { EnvTokenProvider } from "@/services/sharepoint/client/token-provider";
import { isGraphTransport } from "@/services/sharepoint/config/environment";
import { companyMapper } from "@/services/sharepoint/mappers/company.mapper";
import { contactMapper } from "@/services/sharepoint/mappers/contact.mapper";
import { dealMapper } from "@/services/sharepoint/mappers/deal.mapper";
import { rawMaterialMapper } from "@/services/sharepoint/mappers/raw-material.mapper";
import { activityMapper } from "@/services/sharepoint/mappers/activity.mapper";
import { commercialPackageMapper } from "@/services/sharepoint/mappers/commercial-package.mapper";
import { GraphListRepository } from "@/services/sharepoint/repositories/graph/graph-list.repository";
import { LocalCompaniesRepository } from "@/services/sharepoint/repositories/local/local-companies.repository";
import { LocalContactsRepository } from "@/services/sharepoint/repositories/local/local-contacts.repository";
import { LocalDealsRepository } from "@/services/sharepoint/repositories/local/local-deals.repository";
import { LocalRawMaterialsRepository } from "@/services/sharepoint/repositories/local/local-raw-materials.repository";
import { LocalActivitiesRepository } from "@/services/sharepoint/repositories/local/local-activities.repository";
import { LocalCommercialPackagesRepository } from "@/services/sharepoint/repositories/local/local-commercial-packages.repository";
import { CompaniesService } from "@/services/sharepoint/services/companies.service";
import { ContactsService } from "@/services/sharepoint/services/contacts.service";
import { DealsService } from "@/services/sharepoint/services/deals.service";
import { RawMaterialsService } from "@/services/sharepoint/services/raw-materials.service";
import { ActivitiesService } from "@/services/sharepoint/services/activities.service";
import { CommercialPackagesService } from "@/services/sharepoint/services/commercial-packages.service";
import type { ICompaniesService } from "@/services/sharepoint/interfaces/company.interface";
import type { IContactsService } from "@/services/sharepoint/interfaces/contact.interface";
import type { IDealsService } from "@/services/sharepoint/interfaces/deal.interface";
import type { IRawMaterialsService } from "@/services/sharepoint/interfaces/raw-material.interface";
import type { IActivitiesService } from "@/services/sharepoint/interfaces/activity.interface";
import type { ICommercialPackagesService } from "@/services/sharepoint/interfaces/commercial-package.interface";

export type SharePointServices = {
  companies: ICompaniesService;
  contacts: IContactsService;
  deals: IDealsService;
  rawMaterials: IRawMaterialsService;
  activities: IActivitiesService;
  commercialPackages: ICommercialPackagesService;
};

let serverServices: SharePointServices | null = null;

export function createServerSharePointServices(): SharePointServices {
  const cache = new NoOpCacheProvider();

  if (isGraphTransport()) {
    const graphClient = new GraphHttpClient(new EnvTokenProvider());
    const listClient = new SharePointListClient(graphClient, cache);

    return {
      companies: new CompaniesService(
        new GraphListRepository(listClient, "companies", companyMapper),
      ),
      contacts: new ContactsService(
        new GraphListRepository(listClient, "contacts", contactMapper),
      ),
      deals: new DealsService(
        new GraphListRepository(listClient, "deals", dealMapper),
      ),
      rawMaterials: new RawMaterialsService(
        new GraphListRepository(listClient, "rawMaterials", rawMaterialMapper),
      ),
      activities: new ActivitiesService(
        new GraphListRepository(listClient, "activities", activityMapper),
      ),
      commercialPackages: new CommercialPackagesService(
        new GraphListRepository(
          listClient,
          "commercialPackages",
          commercialPackageMapper,
        ),
      ),
    };
  }

  return {
    companies: new CompaniesService(new LocalCompaniesRepository()),
    contacts: new ContactsService(new LocalContactsRepository()),
    deals: new DealsService(new LocalDealsRepository()),
    rawMaterials: new RawMaterialsService(new LocalRawMaterialsRepository()),
    activities: new ActivitiesService(new LocalActivitiesRepository()),
    commercialPackages: new CommercialPackagesService(
      new LocalCommercialPackagesRepository(),
    ),
  };
}

export function getServerSharePointServices(): SharePointServices {
  if (!serverServices) {
    serverServices = createServerSharePointServices();
  }
  return serverServices;
}

export function resetServerSharePointServices(): void {
  serverServices = null;
}
