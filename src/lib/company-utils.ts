import type { Company } from "@/lib/companies-data";
import type { PipelineRow } from "@/types/pipeline";

export function getLinkedPipelines(
  company: Company,
  pipelines: PipelineRow[],
): PipelineRow[] {
  const linked = new Set(company.pipelineIds);
  return pipelines.filter((pipeline) => linked.has(pipeline.id));
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
