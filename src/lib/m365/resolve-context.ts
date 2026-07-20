import type { Company, Contact } from "@/types/company";
import type { Activity } from "@/types/activity";
import type { PipelineRow } from "@/types/pipeline";
import {
  readActivities,
  readCompanies,
  readInventory,
  readPipelines,
} from "@/lib/pipeline-db";
import { getContactDisplayName } from "@/types/contact";
import { resolveCompanyForEmail } from "@/lib/m365/company-resolution";

export type M365DataContext = {
  companies: Company[];
  pipelines: PipelineRow[];
  activities: Activity[];
  inventory: Awaited<ReturnType<typeof readInventory>>;
};

export async function loadM365DataContext(): Promise<M365DataContext> {
  const [companies, pipelines, activities, inventory] = await Promise.all([
    readCompanies(),
    readPipelines(),
    readActivities(),
    readInventory(),
  ]);

  return { companies, pipelines, activities, inventory };
}

export function resolveCompanyById(
  companies: Company[],
  companyId: string,
): Company | null {
  return companies.find((c) => c.CompanyID === companyId) ?? null;
}

export function resolveCompanyByContactEmail(
  companies: Company[],
  email: string,
): { company: Company; contact: Contact } | null {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  for (const company of companies) {
    for (const contact of company.contacts) {
      if (contact.Email?.trim().toLowerCase() === normalized) {
        return { company, contact };
      }
    }
  }

  return null;
}

export function resolveContactDisplayName(contact: Contact): string {
  return getContactDisplayName(contact);
}

export type M365ResolveInput =
  | { companyId: string }
  | { email: string };

export function resolveCompanyFromInput(
  companies: Company[],
  input: M365ResolveInput,
): { company: Company; contact?: Contact } | null {
  if ("companyId" in input && input.companyId) {
    const company = resolveCompanyById(companies, input.companyId);
    return company ? { company } : null;
  }

  if ("email" in input && input.email) {
    const company = resolveCompanyForEmail(companies, input.email);
    if (!company) return null;

    const normalized = input.email.trim().toLowerCase();
    const contact = company.contacts.find(
      (c) => c.Email?.trim().toLowerCase() === normalized,
    );

    return contact ? { company, contact } : { company };
  }

  return null;
}
