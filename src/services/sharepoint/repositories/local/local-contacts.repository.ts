import { paginateArray } from "@/services/sharepoint/client/pagination";
import { SharePointServiceError } from "@/services/sharepoint/client/errors";
import type { IListRepository } from "@/services/sharepoint/client/types";
import type { Contact, CreateContactInput, UpdateContactInput } from "@/types/contact";
import { contactFromStoredRecord } from "@/services/sharepoint/mappers/contact.mapper";
import { assertExternalContactEmail } from "@/lib/internal-colleague";
import {
  createRegistryContact,
  deleteRegistryContact,
  getRegistryContactById,
  updateRegistryContact,
} from "@/lib/contact-registry";
import {
  createCompanyContact,
  deleteCompanyContact,
  readCompanies,
  transferCompanyContactWithHistory,
  updateCompanyContact,
} from "@/lib/pipeline-db";

export class LocalContactsRepository
  implements IListRepository<Contact, CreateContactInput, UpdateContactInput>
{
  private async flattenContacts(): Promise<Contact[]> {
    const companies = await readCompanies();
    const contacts: Contact[] = [];

    for (const company of companies) {
      for (const nested of company.contacts) {
        contacts.push(contactFromStoredRecord(company, nested));
      }
    }

    return contacts;
  }

  async list(page?: Parameters<typeof paginateArray>[1]): Promise<
    ReturnType<typeof paginateArray<Contact>>
  > {
    return paginateArray(await this.flattenContacts(), page);
  }

  async getById(id: string | number): Promise<Contact> {
    const fromRegistry = await getRegistryContactById(id);
    if (fromRegistry) return fromRegistry;

    const contact = (await this.flattenContacts()).find(
      (row) => row.id === Number(id) || row.ContactID === String(id),
    );
    if (!contact) throw SharePointServiceError.notFound("Contact", id);
    return contact;
  }

  async create(input: CreateContactInput): Promise<Contact> {
    assertExternalContactEmail(input.Email);
    const created = await createRegistryContact(input);
    if (created) return created;

    const companies = await readCompanies();
    const companyRef = input.Company;
    const companyId =
      "CompanyID" in companyRef
        ? companyRef.CompanyID
        : companies.find((c) => c.id === companyRef.Id)?.CompanyID;

    if (!companyId) {
      throw SharePointServiceError.validation("Company reference is required");
    }

    const createdJson = await createCompanyContact(companyId, input);
    const company = companies.find((c) => c.CompanyID === companyId)!;
    return contactFromStoredRecord(company, createdJson);
  }

  async update(
    id: string | number,
    patch: UpdateContactInput,
  ): Promise<Contact> {
    const updated = await updateRegistryContact(id, patch);
    if (updated) return updated;

    try {
      const existing = await this.getById(id);
      const companies = await readCompanies();
      const company = companies.find((c) => c.id === existing.Company.Id);
      if (!company) throw SharePointServiceError.notFound("Company", existing.Company.Id);

      const { Company: companyPatch, ...fieldPatch } = patch;

      if (companyPatch) {
        const targetCompanyId =
          "CompanyID" in companyPatch
            ? companyPatch.CompanyID
            : companies.find((c) => c.id === companyPatch.Id)?.CompanyID ?? null;

        if (targetCompanyId && targetCompanyId !== company.CompanyID) {
          const moved = await transferCompanyContactWithHistory(existing.ContactID, {
            targetCompanyId,
            newRole: fieldPatch.Role,
            newJobTitle: fieldPatch.JobTitle,
            employmentStatus: fieldPatch.EmploymentStatus,
          });
          const refreshedCompanies = await readCompanies();
          const targetCompany = refreshedCompanies.find((c) => c.CompanyID === targetCompanyId);
          if (!targetCompany) {
            throw SharePointServiceError.notFound("Company", targetCompanyId);
          }

          if (Object.keys(fieldPatch).length > 0) {
            const rest: UpdateContactInput = { ...fieldPatch };
            delete rest.Role;
            delete rest.JobTitle;
            delete rest.EmploymentStatus;
            if (Object.keys(rest).length > 0) {
              const next = await updateCompanyContact(
                targetCompanyId,
                existing.ContactID,
                rest,
              );
              return contactFromStoredRecord(targetCompany, next);
            }
          }

          return contactFromStoredRecord(targetCompany, moved);
        }
      }

      const next = await updateCompanyContact(company.CompanyID, existing.ContactID, patch);
      return contactFromStoredRecord(company, next);
    } catch (error) {
      if (error instanceof SharePointServiceError) throw error;
      throw SharePointServiceError.notFound("Contact", id);
    }
  }

  async delete(id: string | number): Promise<void> {
    if (await deleteRegistryContact(id)) return;

    const existing = await this.getById(id);
    const companies = await readCompanies();
    const company = companies.find((c) => c.id === existing.Company.Id);
    if (!company) throw SharePointServiceError.notFound("Company", existing.Company.Id);

    await deleteCompanyContact(company.CompanyID, existing.ContactID);
  }
}
