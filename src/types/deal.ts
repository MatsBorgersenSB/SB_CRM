import type {
  CompanyRole,
  PipelineCurrency,
  PipelineRow,
} from "@/types/pipeline";

/**
 * Domain alias — Deals list rows map 1:1 to the frozen pipeline SharePoint schema.
 * `id` is the tracking identifier (e.g. PL-1042).
 */
export type Deal = PipelineRow;

export type CreateDealInput = Omit<Deal, "id"> & { id?: string };

/** Minimal opportunity create — company workspace. Extra fields get sensible defaults. */
export type CreateOpportunityInput = {
  companyId: string;
  assetName: string;
  companyRole: CompanyRole;
  /** One or more Standard Bio offerings in scope. */
  offeringIds: string[];
  salesValue?: number;
  expectedCloseDate?: string;
  currency?: PipelineCurrency;
};

export type UpdateDealInput = Partial<Omit<Deal, "id">>;
