import { findCompanyForDeal } from "@/lib/opportunity-intelligence-engine";
import type { CommercialPackage, QuotationKind } from "@/types/commercial-package";
import { QUOTATION_KIND_LABELS } from "@/types/commercial-package";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type { DealDocumentContext } from "@/types/smartdoc-library";
import { getLifecycleStage, opportunityPublicCode } from "@/types/pipeline";

function latestQuotationKind(
  packages: CommercialPackage[],
  dealId: string,
): QuotationKind | null {
  const dealPackages = packages.filter((record) => record.DealId === dealId);
  for (const kind of ["formal_quotation", "budget_quotation", "price_indication"] as const) {
    if (dealPackages.some((record) => record.kind === kind)) return kind;
  }
  return null;
}

export function inferCommercialStage(
  pipeline: PipelineRow,
  packages: CommercialPackage[],
): string {
  const quotationKind = latestQuotationKind(packages, pipeline.id);
  if (quotationKind) {
    return QUOTATION_KIND_LABELS[quotationKind];
  }

  const stage = getLifecycleStage(pipeline.status);
  if (stage === "sales") return pipeline.status;
  if (stage === "delivery") return `Delivery · ${pipeline.status}`;
  return `Production · ${pipeline.status}`;
}

export function buildDealDocumentContext(
  pipeline: PipelineRow,
  companies: Company[],
  packages: CommercialPackage[],
  createdAt: string = new Date().toISOString(),
): DealDocumentContext {
  const company = findCompanyForDeal(pipeline.id, companies);

  const plNumber = opportunityPublicCode(pipeline);

  return {
    plNumber,
    clientName: company?.Title ?? pipeline.ClientLookup ?? plNumber,
    dealId: pipeline.id,
    dealName: pipeline.assetName,
    commercialStage: inferCommercialStage(pipeline, packages),
    createdAt,
  };
}
