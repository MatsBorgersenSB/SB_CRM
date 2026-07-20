import type { Deal } from "@/types/deal";
import type { GraphListItem, ListItemMapper } from "@/services/sharepoint/client/types";

type DealFields = {
  DealID: string;
  Title: string;
  CompanyRole: string;
  TargetFeedstock: string;
  ReactorDesignCapacity: number;
  CurrentMilestone: string;
  Status: string;
  SalesValue: number;
  Currency: string;
  Probability: number;
  ClientLookup?: string;
  DocCategory?: string;
  DocType?: string;
  Revision?: string;
  FileLeafRef?: string;
};

export const dealMapper: ListItemMapper<DealFields, Deal> = {
  toDomain(item: GraphListItem<DealFields>): Deal {
    const fields = item.fields;
    return {
      id: fields.DealID,
      assetName: fields.Title,
      companyRole: fields.CompanyRole as Deal["companyRole"],
      targetFeedstock: fields.TargetFeedstock ?? "",
      reactorDesignCapacity: fields.ReactorDesignCapacity ?? 0,
      currentMilestone: fields.CurrentMilestone ?? "",
      status: fields.Status as Deal["status"],
      salesValue: fields.SalesValue ?? 0,
      currency: fields.Currency ?? "EUR",
      probability: fields.Probability ?? 0,
      ClientLookup: fields.ClientLookup,
      DocCategory: fields.DocCategory,
      DocType: fields.DocType,
      Revision: fields.Revision,
      FileLeafRef: fields.FileLeafRef,
    };
  },

  toFields(input: Partial<Deal>): Record<string, unknown> {
    const fields: Record<string, unknown> = {};
    if (input.id !== undefined) fields.DealID = input.id;
    if (input.assetName !== undefined) fields.Title = input.assetName;
    if (input.companyRole !== undefined) fields.CompanyRole = input.companyRole;
    if (input.targetFeedstock !== undefined) {
      fields.TargetFeedstock = input.targetFeedstock;
    }
    if (input.reactorDesignCapacity !== undefined) {
      fields.ReactorDesignCapacity = input.reactorDesignCapacity;
    }
    if (input.currentMilestone !== undefined) {
      fields.CurrentMilestone = input.currentMilestone;
    }
    if (input.status !== undefined) fields.Status = input.status;
    if (input.salesValue !== undefined) fields.SalesValue = input.salesValue;
    if (input.currency !== undefined) fields.Currency = input.currency;
    if (input.probability !== undefined) fields.Probability = input.probability;
    if (input.ClientLookup !== undefined) fields.ClientLookup = input.ClientLookup;
    if (input.DocCategory !== undefined) fields.DocCategory = input.DocCategory;
    if (input.DocType !== undefined) fields.DocType = input.DocType;
    if (input.Revision !== undefined) fields.Revision = input.Revision;
    if (input.FileLeafRef !== undefined) fields.FileLeafRef = input.FileLeafRef;
    return fields;
  },
};

/** Converts local pipeline row (frozen app shape) to Graph fields. */
export function dealToGraphFields(deal: Partial<Deal>): Record<string, unknown> {
  return dealMapper.toFields(deal);
}
