import type { Company, Contact, SharePointPerson } from "@/types/company";
import type { CompanyType } from "@/types/company-type";
import { buildContactTitle } from "@/types/contact";
import type { CreateContactInput } from "@/types/contact";
import type { Activity } from "@/types/activity";

export function nextCompanyTrackingId(companies: Company[]): string {
  const max = companies.reduce((current, company) => {
    const numeric = Number(company.CompanyID.replace("CO-", ""));
    return Number.isFinite(numeric) ? Math.max(current, numeric) : current;
  }, 1000);

  return `CO-${max + 1}`;
}

export function nextSharePointListId(companies: Company[]): number {
  return companies.reduce((max, company) => Math.max(max, company.id), 0) + 1;
}

export function nextContactId(companies: Company[]): string {
  let max = 10000;

  for (const company of companies) {
    for (const contact of company.contacts) {
      const numeric = Number(contact.ContactID.replace("CT-", ""));
      if (Number.isFinite(numeric)) max = Math.max(max, numeric);
    }
  }

  return `CT-${max + 1}`;
}

export function nextContactSharePointId(companies: Company[]): number {
  let max = 100;

  for (const company of companies) {
    for (const contact of company.contacts) {
      if (contact.id > 0) max = Math.max(max, contact.id);
    }
  }

  return max + 1;
}

export function nextActivityId(activities: { ActivityID: string }[]): string {
  const max = activities.reduce((current, activity) => {
    const numeric = Number(activity.ActivityID.replace("ACT-", ""));
    return Number.isFinite(numeric) ? Math.max(current, numeric) : current;
  }, 9000);

  return `ACT-${max + 1}`;
}

/** @deprecated Use nextActivityId */
export function nextInteractionId(activities: { ActivityID: string }[]): string {
  return nextActivityId(activities);
}

export function nextActivitySharePointId(activities: Activity[]): number {
  return activities.reduce((max, activity) => Math.max(max, activity.id), 0) + 1;
}

export function nextPipelineId(
  pipelines: Array<{ id: string; code?: string | null }>,
): string {
  const max = pipelines.reduce((current, pipeline) => {
    for (const candidate of [pipeline.code, pipeline.id]) {
      if (!candidate) continue;
      const numeric = Number(candidate.replace(/^PL-/i, ""));
      if (Number.isFinite(numeric)) return Math.max(current, numeric);
    }
    return current;
  }, 1000);

  return `PL-${max + 1}`;
}

export type NewContactInput = CreateContactInput;

export type NewCompanyInput = Pick<
  Company,
  "Title" | "Industry" | "Status" | "City" | "Domain" | "Phone"
> & {
  AddressLine1?: string;
  PostalCode?: string;
  Email?: string;
  Country?: Company["Country"];
  countryCode?: string | null;
  continent?: string | null;
  organizationNumber?: string | null;
  vatNumber?: string | null;
  Notes?: string;
  ParentCompany?: Company["ParentCompany"];
  CompanyTypes?: CompanyType[];
  AccountOwner?: SharePointPerson;
};
