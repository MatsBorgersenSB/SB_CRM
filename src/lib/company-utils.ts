import type { Company } from "@/lib/companies-data";
import type { PipelineRow } from "@/types/pipeline";

export function getLinkedPipelines(
  company: Company,
  pipelines: PipelineRow[],
): PipelineRow[] {
  const linked = new Set(company.pipelineIds);
  const companyKeys = new Set(
    [company.CompanyID, company.code]
      .map((value) => value?.trim().toUpperCase())
      .filter((value): value is string => Boolean(value)),
  );
  const contactIds = new Set(
    (company.contacts ?? [])
      .map((contact) => contact.ContactID?.trim())
      .filter((id): id is string => Boolean(id)),
  );

  return pipelines.filter((pipeline) => {
    if (linked.has(pipeline.id)) return true;
    if (pipeline.code && linked.has(pipeline.code)) return true;
    if (
      pipeline.linkedCompanyIds?.some((id) =>
        companyKeys.has(id.trim().toUpperCase()),
      )
    ) {
      return true;
    }
    // If a company contact or company entry sits on the opportunity roster, the company is in play.
    return Boolean(
      pipeline.team?.some(
        (member) =>
          (member.contactId && contactIds.has(member.contactId)) ||
          (member.companyId &&
            companyKeys.has(member.companyId.trim().toUpperCase())),
      ),
    );
  });
}

export function getCompanySmartDocs(
  company: Company,
  pipelines: PipelineRow[],
): PipelineRow[] {
  const linkedIds = new Set(company.pipelineIds);

  return pipelines.filter(
    (pipeline) =>
      linkedIds.has(pipeline.id) &&
      pipeline.FileLeafRef &&
      linkedIds.has(pipeline.ClientLookup ?? pipeline.id),
  );
}
