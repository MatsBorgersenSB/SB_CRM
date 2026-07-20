import type { PipelineRow } from "@/types/pipeline";
import { formatDealValue } from "@/types/pipeline";

export function sumPipelineValue(pipelines: PipelineRow[]): string {
  if (pipelines.length === 0) return "—";

  const byCurrency = new Map<string, number>();
  for (const pipeline of pipelines) {
    byCurrency.set(
      pipeline.currency,
      (byCurrency.get(pipeline.currency) ?? 0) + pipeline.salesValue,
    );
  }

  return [...byCurrency.entries()]
    .map(([currency, value]) => formatDealValue(currency, value))
    .join(" · ");
}

export function buildPipelineImpactLines(pipelines: PipelineRow[]): string[] {
  if (pipelines.length === 0) return ["No active pipeline value"];

  const value = sumPipelineValue(pipelines);
  return [
    `${pipelines.length} active opportunit${pipelines.length === 1 ? "y" : "ies"}`,
    `${value} pipeline value`,
  ];
}

export function buildDocumentImpactLines(input: {
  companyCount: number;
  opportunityCount: number;
  referenceCount: number;
  businessImpactLevel: string;
  riskCount: number;
}): string[] {
  const lines: string[] = [];

  if (input.opportunityCount > 0) {
    lines.push(
      `${input.opportunityCount} active opportunit${input.opportunityCount === 1 ? "y" : "ies"}`,
    );
  }
  if (input.companyCount > 0) {
    lines.push(`${input.companyCount} linked compan${input.companyCount === 1 ? "y" : "ies"}`);
  }
  if (input.referenceCount > 0) {
    lines.push(`${input.referenceCount} activity reference${input.referenceCount === 1 ? "" : "s"}`);
  }
  lines.push(`${input.businessImpactLevel} business impact`);
  if (input.riskCount > 0) {
    lines.push(`${input.riskCount} risk signal${input.riskCount === 1 ? "" : "s"} detected`);
  }

  return lines;
}
