import type { Company, SharePointPerson } from "@/types/company";
import { buildCompanyOwnerOptions as buildOwnerOptionsFromRegistry } from "@/lib/company-owner";
import type { PipelineRow } from "@/types/pipeline";

export function resolveOpportunityOwner(
  pipeline: PipelineRow,
  company: Company | undefined,
): SharePointPerson | null {
  if (pipeline.opportunityOwner?.Title) {
    return pipeline.opportunityOwner;
  }
  return company?.AccountOwner ?? null;
}

export function buildAssignableOwnerOptions(companies: Company[]): SharePointPerson[] {
  return buildOwnerOptionsFromRegistry(companies);
}
