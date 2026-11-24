import type { SharePointPerson } from "@/types/company";

/** Standard Bio internal user — CRM relationship owner. */
export type BioUser = SharePointPerson;

/** Canonical Standard Bio staff eligible as company / opportunity owners. */
export const STANDARD_BIO_USERS: BioUser[] = [
  { Id: 1, Title: "Mats Borgersen", Email: "mats.borgersen@standard.bio" },
  { Id: 100, Title: "Walter Aker", Email: "walter.aker@standard.bio" },
  { Id: 101, Title: "Hugo Jansson", Email: "hugo.jansson@standard.bio" },
  { Id: 102, Title: "Ola Kjelsoas Rogndokken", Email: "okr@standard.bio" },
  { Id: 103, Title: "Bjørn Molskred", Email: "bjorn.molskred@standard.bio" },
];
