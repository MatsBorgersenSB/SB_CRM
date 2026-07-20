/** Frozen SharePoint list display names (site-relative). */
export const SHAREPOINT_LISTS = {
  companies: process.env.SP_LIST_COMPANIES ?? "Companies",
  contacts: process.env.SP_LIST_CONTACTS ?? "Contacts",
  deals: process.env.SP_LIST_DEALS ?? "Deals",
  rawMaterials: process.env.SP_LIST_RAW_MATERIALS ?? "RawMaterials",
  activities: process.env.SP_LIST_ACTIVITIES ?? "Activities",
  commercialPackages: process.env.SP_LIST_COMMERCIAL_PACKAGES ?? "CommercialPackages",
  smartDocs: process.env.SP_LIST_SMARTDOCS ?? "SmartDocs",
} as const;

export type SharePointListName =
  (typeof SHAREPOINT_LISTS)[keyof typeof SHAREPOINT_LISTS];

export const SHAREPOINT_LIST_KEYS = {
  companies: "companies",
  contacts: "contacts",
  deals: "deals",
  rawMaterials: "rawMaterials",
  activities: "activities",
  commercialPackages: "commercialPackages",
  smartDocs: "smartDocs",
} as const;

export type SharePointListKey =
  (typeof SHAREPOINT_LIST_KEYS)[keyof typeof SHAREPOINT_LIST_KEYS];

export function resolveListName(key: SharePointListKey): string {
  return SHAREPOINT_LISTS[key];
}
