import type { Company } from "@/types/company";
import type { GraphListItem, ListItemMapper } from "@/services/sharepoint/client/types";

type CompanyFields = {
  Title: string;
  CompanyID: string;
  ParentCompanyLookupId?: number;
  ParentCompany?: { LookupValue?: string };
  Domain: string;
  Industry: string;
  Status: string;
  AccountOwnerLookupId?: number;
  AccountOwner?: { LookupValue?: string };
  Phone: string;
  Email?: string;
  AddressLine1: string;
  AddressLine2: string;
  PostalCode: string;
  City: string;
  CountryLookupId?: number;
  Country?: { LookupValue?: string };
};

function readLookup(
  id?: number,
  title?: string,
): { Id: number; Title: string } | null {
  if (!id) return null;
  return { Id: id, Title: title ?? "" };
}

export const companyMapper: ListItemMapper<CompanyFields, Company> = {
  toDomain(item: GraphListItem<CompanyFields>): Company {
    const fields = item.fields;
    return {
      id: Number(item.id),
      Title: fields.Title,
      CompanyID: fields.CompanyID,
      ParentCompany: readLookup(
        fields.ParentCompanyLookupId,
        fields.ParentCompany?.LookupValue,
      ),
      Domain: fields.Domain ?? "",
      Industry: fields.Industry as Company["Industry"],
      Status: fields.Status as Company["Status"],
      AccountOwner: readLookup(
        fields.AccountOwnerLookupId,
        fields.AccountOwner?.LookupValue,
      ),
      Phone: fields.Phone ?? "",
      Email: fields.Email ?? "",
      AddressLine1: fields.AddressLine1 ?? "",
      AddressLine2: fields.AddressLine2 ?? "",
      PostalCode: fields.PostalCode ?? "",
      City: fields.City ?? "",
      Country: readLookup(
        fields.CountryLookupId,
        fields.Country?.LookupValue,
      ),
      pipelineIds: [],
      contacts: [],
    };
  },

  toFields(input: Partial<Company>): Record<string, unknown> {
    const fields: Record<string, unknown> = {};

    if (input.Title !== undefined) fields.Title = input.Title;
    if (input.CompanyID !== undefined) fields.CompanyID = input.CompanyID;
    if (input.Domain !== undefined) fields.Domain = input.Domain;
    if (input.Industry !== undefined) fields.Industry = input.Industry;
    if (input.Status !== undefined) fields.Status = input.Status;
    if (input.Phone !== undefined) fields.Phone = input.Phone;
    if (input.Email !== undefined) fields.Email = input.Email;
    if (input.AddressLine1 !== undefined) fields.AddressLine1 = input.AddressLine1;
    if (input.AddressLine2 !== undefined) fields.AddressLine2 = input.AddressLine2;
    if (input.PostalCode !== undefined) fields.PostalCode = input.PostalCode;
    if (input.City !== undefined) fields.City = input.City;
    if (input.ParentCompany === null) {
      fields.ParentCompanyLookupId = null;
    } else if (input.ParentCompany) {
      fields.ParentCompanyLookupId = input.ParentCompany.Id;
    }
    if (input.AccountOwner) {
      fields.AccountOwnerLookupId = input.AccountOwner.Id;
    }
    if (input.Country) {
      fields.CountryLookupId = input.Country.Id;
    }

    return fields;
  },
};
