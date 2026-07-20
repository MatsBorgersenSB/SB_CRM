export {
  companiesService,
  contactsService,
  dealsService,
  rawMaterialsService,
  activitiesService,
  createBrowserSharePointServices,
} from "@/services/sharepoint/browser";
export type { BrowserSharePointServices } from "@/services/sharepoint/browser";

export type { IActivitiesService } from "@/services/sharepoint/interfaces/activity.interface";

export type { ICompaniesService } from "@/services/sharepoint/interfaces/company.interface";
export type { IContactsService } from "@/services/sharepoint/interfaces/contact.interface";
export type { IDealsService } from "@/services/sharepoint/interfaces/deal.interface";
export type { IRawMaterialsService } from "@/services/sharepoint/interfaces/raw-material.interface";
export type { ISharePointEntityService } from "@/services/sharepoint/interfaces/common.interface";

export {
  SharePointServiceError,
  isSharePointServiceError,
  toSharePointServiceError,
} from "@/services/sharepoint/client/errors";
export type { PageRequest, PageResult } from "@/services/sharepoint/client/pagination";
export type { ICacheProvider } from "@/services/sharepoint/client/cache-provider";
export type { ISearchProvider } from "@/services/sharepoint/client/search-provider";
