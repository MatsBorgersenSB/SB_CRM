import type { Contact } from "@/types/contact";
import { buildContactTitle } from "@/types/contact";
import type { GraphListItem, ListItemMapper } from "@/services/sharepoint/client/types";

type ContactFields = {
  Title: string;
  ContactID: string;
  FirstName: string;
  LastName: string;
  CompanyLookupId?: number;
  Company?: { LookupValue?: string };
  JobTitle: string;
  Role: string;
  Email: string;
  Phone: string;
  Mobile: string;
  LinkedInURL: string;
  Status: string;
  RelationshipLevel: string;
  buyingRole?: string;
  sentiment?: string;
  influenceLevel?: string;
  reportsToId?: string;
  city?: string;
  country?: string;
  timezone?: string;
  isTimezoneOverridden?: boolean;
  engagementCadence?: string;
  backgroundNotes?: string;
  preferredLanguage?: string;
};

export const contactMapper: ListItemMapper<ContactFields, Contact> = {
  toDomain(item: GraphListItem<ContactFields>): Contact {
    const fields = item.fields;
    return {
      id: Number(item.id),
      ContactID: fields.ContactID,
      Title: fields.Title || buildContactTitle(fields.FirstName, fields.LastName),
      FirstName: fields.FirstName ?? "",
      LastName: fields.LastName ?? "",
      Company: {
        Id: fields.CompanyLookupId ?? 0,
        Title: fields.Company?.LookupValue ?? "",
      },
      JobTitle: fields.JobTitle ?? "",
      Role: fields.Role as Contact["Role"],
      Email: fields.Email ?? "",
      Phone: fields.Phone ?? "",
      Mobile: fields.Mobile ?? "",
      LinkedInURL: fields.LinkedInURL ?? "",
      Status: fields.Status as Contact["Status"],
      RelationshipLevel: fields.RelationshipLevel as Contact["RelationshipLevel"],
      buyingRole: fields.buyingRole as Contact["buyingRole"],
      sentiment: fields.sentiment as Contact["sentiment"],
      influenceLevel: fields.influenceLevel as Contact["influenceLevel"],
      reportsToId: fields.reportsToId ?? "",
      city: fields.city ?? "",
      country: fields.country ?? "",
      timezone: fields.timezone ?? "",
      isTimezoneOverridden: Boolean(fields.isTimezoneOverridden),
      engagementCadence: fields.engagementCadence as Contact["engagementCadence"],
      backgroundNotes: fields.backgroundNotes ?? "",
      preferredLanguage: fields.preferredLanguage ?? "",
    };
  },

  toFields(input: Partial<Contact>): Record<string, unknown> {
    const fields: Record<string, unknown> = {};

    if (input.FirstName !== undefined || input.LastName !== undefined) {
      const firstName = input.FirstName ?? "";
      const lastName = input.LastName ?? "";
      fields.FirstName = firstName;
      fields.LastName = lastName;
      fields.Title = input.Title ?? buildContactTitle(firstName, lastName);
    } else if (input.Title !== undefined) {
      fields.Title = input.Title;
    }

    if (input.ContactID !== undefined) fields.ContactID = input.ContactID;
    if (input.JobTitle !== undefined) fields.JobTitle = input.JobTitle;
    if (input.Role !== undefined) fields.Role = input.Role;
    if (input.Email !== undefined) fields.Email = input.Email;
    if (input.Phone !== undefined) fields.Phone = input.Phone;
    if (input.Mobile !== undefined) fields.Mobile = input.Mobile;
    if (input.LinkedInURL !== undefined) fields.LinkedInURL = input.LinkedInURL;
    if (input.Status !== undefined) fields.Status = input.Status;
    if (input.RelationshipLevel !== undefined) {
      fields.RelationshipLevel = input.RelationshipLevel;
    }
    if (input.buyingRole !== undefined) fields.buyingRole = input.buyingRole;
    if (input.sentiment !== undefined) fields.sentiment = input.sentiment;
    if (input.influenceLevel !== undefined) fields.influenceLevel = input.influenceLevel;
    if (input.reportsToId !== undefined) fields.reportsToId = input.reportsToId;
    if (input.city !== undefined) fields.city = input.city;
    if (input.country !== undefined) fields.country = input.country;
    if (input.timezone !== undefined) fields.timezone = input.timezone;
    if (input.isTimezoneOverridden !== undefined) {
      fields.isTimezoneOverridden = input.isTimezoneOverridden;
    }
    if (input.engagementCadence !== undefined) {
      fields.engagementCadence = input.engagementCadence;
    }
    if (input.backgroundNotes !== undefined) {
      fields.backgroundNotes = input.backgroundNotes;
    }
    if (input.preferredLanguage !== undefined) {
      fields.preferredLanguage = input.preferredLanguage;
    }
    if (input.Company) fields.CompanyLookupId = input.Company.Id;

    return fields;
  },
};

export function contactFromStoredRecord(
  company: { id: number; Title: string },
  contact: Contact,
): Contact {
  return {
    ...contact,
    Company: contact.Company?.Id
      ? contact.Company
      : { Id: company.id, Title: company.Title },
    Title: contact.Title || buildContactTitle(contact.FirstName, contact.LastName),
  };
}
