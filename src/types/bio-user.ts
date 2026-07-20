import type { SharePointPerson } from "@/types/company";

/** Standard Bio internal user — CRM relationship owner. */
export type BioUser = SharePointPerson;

/** Canonical Standard Bio staff eligible as company owners. */
export const STANDARD_BIO_USERS: BioUser[] = [
  { Id: 1, Title: "Mats Borgersen" },
  { Id: 2, Title: "John Smith" },
  { Id: 3, Title: "Maria Andersson" },
  { Id: 12, Title: "Elena Lindström" },
  { Id: 24, Title: "Maya Chen" },
  { Id: 31, Title: "Sofia Marchetti" },
  { Id: 41, Title: "James Holloway" },
  { Id: 51, Title: "Amir Hassan" },
];
