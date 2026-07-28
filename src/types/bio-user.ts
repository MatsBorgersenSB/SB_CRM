import type { SharePointPerson } from "@/types/company";

/** Standard Bio internal user — CRM relationship owner. */
export type BioUser = SharePointPerson;

/** Canonical Standard Bio staff eligible as company / opportunity owners. */
export const STANDARD_BIO_USERS: BioUser[] = [
  { Id: 1, Title: "Mats Borgersen" },
  { Id: 100, Title: "Walter Aker" },
  { Id: 101, Title: "Hugo Jansson" },
  { Id: 102, Title: "Ola Kjelsoas Rogndokken" },
  { Id: 103, Title: "Bjørn Molskred" },
];
