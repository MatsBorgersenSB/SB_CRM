import type { Company, Contact } from "@/lib/companies-data";
import type { CreateContactInput, UpdateContactInput } from "@/types/contact";
import type { UpdateCompanyInput } from "@/services/sharepoint/repositories/local/local-companies.repository";
import type { UserRole } from "@/types/auth";
import { AUTH_ROLE_HEADER } from "@/lib/api-auth";
import { toSharePointServiceError } from "@/services/sharepoint/client/errors";
import { SharePointServiceError } from "@/services/sharepoint/client/errors";
import { readResponseBody } from "@/services/sharepoint/client/response-body";
import {
  companiesService,
  contactsService,
} from "@/services/sharepoint/browser";

export async function syncCompanyRecord(
  companyId: string,
  patch: UpdateCompanyInput,
): Promise<Company> {
  try {
    return await companiesService.update(companyId, patch);
  } catch (error) {
    throw toSharePointServiceError(error);
  }
}

export async function syncCompanyContact(
  companyId: string,
  contactId: string,
  patch: UpdateContactInput,
): Promise<Contact> {
  try {
    return await contactsService.update(contactId, patch);
  } catch (error) {
    throw toSharePointServiceError(error);
  }
}

export async function createCompanyRecord(
  input: Parameters<typeof companiesService.create>[0],
): Promise<Company> {
  try {
    return await companiesService.create(input);
  } catch (error) {
    throw toSharePointServiceError(error);
  }
}

export async function createContactRecord(
  companyId: string,
  input: CreateContactInput,
): Promise<Contact> {
  try {
    return await contactsService.createForCompany(companyId, {
      ...input,
      Company: { CompanyID: companyId },
    });
  } catch (error) {
    throw toSharePointServiceError(error);
  }
}

async function deleteEntity(path: string, role: UserRole): Promise<void> {
  const response = await fetch(path, {
    method: "DELETE",
    headers: { [AUTH_ROLE_HEADER]: role },
  });

  const body = await readResponseBody(response);

  if (!response.ok) {
    throw SharePointServiceError.fromResponse(response, body);
  }
}

export async function deleteContactRecord(
  contactId: string,
  role: UserRole = "superuser",
): Promise<void> {
  try {
    await deleteEntity(`/api/contacts/${encodeURIComponent(contactId)}`, role);
  } catch (error) {
    throw toSharePointServiceError(error);
  }
}

async function postContactLifecycle<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = await readResponseBody(response);

  if (!response.ok) {
    throw SharePointServiceError.fromResponse(response, payload);
  }

  return payload as T;
}

export async function transferContactRecord(
  contactId: string,
  input: {
    targetCompanyId: string;
    newRole?: string;
    newJobTitle?: string;
    employmentStatus?: string;
    preview?: boolean;
  },
): Promise<{ contact?: Contact; preview?: unknown }> {
  try {
    return await postContactLifecycle(
      `/api/contacts/${encodeURIComponent(contactId)}/transfer`,
      input,
    );
  } catch (error) {
    throw toSharePointServiceError(error);
  }
}

export async function archiveContactRecord(
  contactId: string,
  archived: boolean,
  employmentStatus?: string,
): Promise<Contact> {
  try {
    const result = await postContactLifecycle<{ contact: Contact }>(
      `/api/contacts/${encodeURIComponent(contactId)}/archive`,
      { archived, employmentStatus },
    );
    return result.contact;
  } catch (error) {
    throw toSharePointServiceError(error);
  }
}

export async function mergeContactRecord(
  primaryContactId: string,
  secondaryContactId: string,
): Promise<Contact> {
  try {
    const result = await postContactLifecycle<{ contact: Contact }>(
      `/api/contacts/${encodeURIComponent(primaryContactId)}/merge`,
      { secondaryContactId },
    );
    return result.contact;
  } catch (error) {
    throw toSharePointServiceError(error);
  }
}

export async function deleteCompanyRecord(
  companyId: string,
  role: UserRole = "superuser",
): Promise<void> {
  try {
    await deleteEntity(`/api/companies/${encodeURIComponent(companyId)}`, role);
  } catch (error) {
    throw toSharePointServiceError(error);
  }
}
