import "server-only";

import { findPrismaCompanyByRouteKey } from "@/lib/resolve-company-route";
import { findPrismaContactByIdOrEmail } from "@/lib/resolve-contact-route";
import { isPrismaConnectionError, withPrismaRetry } from "@/lib/prisma";
import {
  mapPrismaContactToApp,
  stableNumericId,
  toContactTrackingId,
} from "@/lib/prisma-mappers";
import { readCompanies } from "@/lib/pipeline-db";
import { buildContactTitle } from "@/types/contact";
import type {
  Contact,
  ContactListRole,
  ContactStatus,
  CreateContactInput,
  RelationshipLevel,
  UpdateContactInput,
} from "@/types/contact";
import type { EmploymentStatus } from "@/types/contact-lifecycle";

type ContactMeta = {
  role?: ContactListRole | string;
  relationshipLevel?: RelationshipLevel | string;
  employmentStatus?: EmploymentStatus | string;
};

async function prismaRegistryAvailable(): Promise<boolean> {
  try {
    await withPrismaRetry((prisma) => prisma.contact.findFirst({ select: { id: true } }));
    return true;
  } catch (error) {
    if (!isPrismaConnectionError(error)) {
      console.warn(
        "[contact-registry] Prisma unavailable:",
        error instanceof Error ? error.message : error,
      );
    }
    return false;
  }
}

function parseContactMeta(personalNotes: string | null | undefined): ContactMeta {
  if (!personalNotes?.trim()) return {};
  try {
    const parsed = JSON.parse(personalNotes) as ContactMeta;
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    // plain-text notes — ignore
  }
  return {};
}

function serializeContactMeta(
  existingNotes: string | null | undefined,
  patch: UpdateContactInput | CreateContactInput,
): string | null {
  const current = parseContactMeta(existingNotes);
  const next: ContactMeta = {
    ...current,
    ...(patch.Role !== undefined ? { role: patch.Role } : {}),
    ...(patch.RelationshipLevel !== undefined
      ? { relationshipLevel: patch.RelationshipLevel }
      : {}),
    ...(patch.EmploymentStatus !== undefined
      ? { employmentStatus: patch.EmploymentStatus }
      : {}),
  };

  if (!next.role && !next.relationshipLevel && !next.employmentStatus) {
    // Preserve non-JSON notes
    if (existingNotes && !existingNotes.trim().startsWith("{")) return existingNotes;
    return null;
  }

  return JSON.stringify(next);
}

function toPrismaContactStatus(
  status: ContactStatus | undefined,
  archived?: boolean,
): "active" | "archived" {
  if (archived || status === "Inactive" || status === "Archived") return "archived";
  return "active";
}

function buildPhoneNumbers(patch: {
  Phone?: string;
  Mobile?: string;
}): Array<{ number: string; type: string; isPrimary: boolean }> {
  const phones: Array<{ number: string; type: string; isPrimary: boolean }> = [];
  if (patch.Phone?.trim()) {
    phones.push({ number: patch.Phone.trim(), type: "office", isPrimary: true });
  }
  if (patch.Mobile?.trim()) {
    phones.push({
      number: patch.Mobile.trim(),
      type: "mobile",
      isPrimary: phones.length === 0,
    });
  }
  return phones;
}

async function loadMappedContact(prismaId: string): Promise<Contact> {
  const row = await withPrismaRetry((prisma) =>
    prisma.contact.findUniqueOrThrow({
      where: { id: prismaId },
      include: {
        company: { select: { id: true, name: true } },
        reportsTo: { select: { id: true, fullName: true, firstName: true, lastName: true } },
      },
    }),
  );

  const companyLookup = {
    Id: row.companyId ? stableNumericId(row.companyId) : 0,
    Title: row.company?.name ?? "Unknown company",
  };

  const mapped = mapPrismaContactToApp(row, companyLookup);
  const meta = parseContactMeta(row.personalNotes);
  return {
    ...mapped,
    Role: (meta.role as ContactListRole) || mapped.Role,
    RelationshipLevel:
      (meta.relationshipLevel as RelationshipLevel) || mapped.RelationshipLevel,
    EmploymentStatus:
      (meta.employmentStatus as EmploymentStatus) || mapped.EmploymentStatus || "Active",
    reportsToName:
      row.reportsTo?.fullName ||
      `${row.reportsTo?.firstName ?? ""} ${row.reportsTo?.lastName ?? ""}`.trim() ||
      undefined,
    ContactID: toContactTrackingId(row.id),
  };
}

async function resolvePrismaCompanyId(companyRef: string | number | undefined): Promise<string | null> {
  if (companyRef === undefined || companyRef === null || companyRef === "") return null;
  const found = await findPrismaCompanyByRouteKey(String(companyRef));
  return found?.id ?? null;
}

async function resolvePrismaReportsToId(reportsToId: string | undefined): Promise<string | null> {
  const key = reportsToId?.trim();
  if (!key) return null;
  const found = await findPrismaContactByIdOrEmail(key);
  return found?.id ?? null;
}

export async function getRegistryContactById(
  id: string | number,
): Promise<Contact | null> {
  if (!(await prismaRegistryAvailable())) return null;
  const row = await findPrismaContactByIdOrEmail(String(id));
  if (!row) return null;
  return loadMappedContact(row.id);
}

export async function createRegistryContact(
  input: CreateContactInput,
): Promise<Contact | null> {
  if (!(await prismaRegistryAvailable())) return null;

  const companyRef =
    input.Company && "CompanyID" in input.Company
      ? input.Company.CompanyID
      : input.Company && "Id" in input.Company
        ? input.Company.Id
        : undefined;
  const companyId = await resolvePrismaCompanyId(companyRef ?? undefined);
  if (!companyId) return null;

  const firstName = input.FirstName.trim();
  const lastName = input.LastName.trim();
  const fullName = buildContactTitle(firstName, lastName);
  const jobTitle = input.JobTitle.trim() || input.Role;
  const personalNotes = serializeContactMeta(null, input);

  const created = await withPrismaRetry(async (prisma) =>
    prisma.contact.create({
      data: {
        firstName,
        lastName,
        fullName,
        jobTitle: jobTitle || null,
        linkedInUrl: input.LinkedInURL.trim() || null,
        buyingRole: input.buyingRole?.trim() || null,
        sentiment: input.sentiment?.trim() || null,
        influenceLevel: input.influenceLevel?.trim() || null,
        reportsToId: await resolvePrismaReportsToId(input.reportsToId ?? undefined),
        city: input.city?.trim() || null,
        country: input.country?.trim() || null,
        timezone: input.timezone?.trim() || null,
        isTimezoneOverridden: Boolean(input.isTimezoneOverridden),
        engagementCadence: input.engagementCadence?.trim() || null,
        backgroundNotes: input.backgroundNotes?.trim() || null,
        preferredLanguage: input.preferredLanguage?.trim() || null,
        status: toPrismaContactStatus(input.Status),
        companyId,
        personalNotes,
        emails: input.Email.trim()
          ? [{ address: input.Email.trim().toLowerCase(), type: "work", isPrimary: true }]
          : [],
        phoneNumbers: buildPhoneNumbers(input),
      },
    }),
  );

  return loadMappedContact(created.id);
}

export async function updateRegistryContact(
  id: string | number,
  patch: UpdateContactInput,
): Promise<Contact | null> {
  if (!(await prismaRegistryAvailable())) return null;

  let existing = await findPrismaContactByIdOrEmail(String(id));

  // Promote JSON-seeded CT-… contacts into Prisma on first save.
  if (!existing) {
    const companies = await readCompanies();
    let jsonContact: Contact | null = null;
    let jsonCompanyId = "";

    for (const company of companies) {
      const found = company.contacts.find(
        (contact) =>
          contact.ContactID === String(id) || String(contact.id) === String(id),
      );
      if (found) {
        jsonContact = found;
        jsonCompanyId = company.CompanyID;
        break;
      }
    }

    if (!jsonContact) return null;

    const prismaCompanyId =
      (await resolvePrismaCompanyId(jsonCompanyId)) ??
      (await resolvePrismaCompanyId(jsonContact.Company?.Id));

    const firstName = patch.FirstName?.trim() ?? jsonContact.FirstName;
    const lastName = patch.LastName?.trim() ?? jsonContact.LastName;
    const jobTitle =
      patch.JobTitle?.trim() ||
      patch.Role ||
      jsonContact.JobTitle ||
      jsonContact.Role;
    const email = patch.Email?.trim() ?? jsonContact.Email;
    const phone = patch.Phone?.trim() ?? jsonContact.Phone;
    const mobile = patch.Mobile?.trim() ?? jsonContact.Mobile;
    const personalNotes = serializeContactMeta(null, {
      ...jsonContact,
      ...patch,
      Role: patch.Role ?? jsonContact.Role,
      RelationshipLevel: patch.RelationshipLevel ?? jsonContact.RelationshipLevel,
      EmploymentStatus: patch.EmploymentStatus ?? jsonContact.EmploymentStatus,
    });

    const created = await withPrismaRetry(async (prisma) =>
      prisma.contact.create({
        data: {
          id: jsonContact!.ContactID,
          firstName,
          lastName,
          fullName: buildContactTitle(firstName, lastName),
          jobTitle: jobTitle || null,
          linkedInUrl: (patch.LinkedInURL ?? jsonContact!.LinkedInURL).trim() || null,
          buyingRole: patch.buyingRole?.trim() || jsonContact!.buyingRole || null,
          sentiment: patch.sentiment?.trim() || jsonContact!.sentiment || null,
          influenceLevel:
            patch.influenceLevel?.trim() || jsonContact!.influenceLevel || null,
          reportsToId:
            (await resolvePrismaReportsToId(patch.reportsToId ?? jsonContact!.reportsToId)) ||
            null,
          city: patch.city?.trim() || jsonContact!.city || null,
          country: patch.country?.trim() || jsonContact!.country || null,
          timezone: patch.timezone?.trim() || jsonContact!.timezone || null,
          isTimezoneOverridden:
            patch.isTimezoneOverridden ?? jsonContact!.isTimezoneOverridden ?? false,
          engagementCadence:
            patch.engagementCadence?.trim() || jsonContact!.engagementCadence || null,
          backgroundNotes:
            patch.backgroundNotes?.trim() || jsonContact!.backgroundNotes || null,
          preferredLanguage:
            patch.preferredLanguage?.trim() || jsonContact!.preferredLanguage || null,
          status: toPrismaContactStatus(
            patch.Status ?? jsonContact!.Status,
            patch.IsArchived ?? jsonContact!.IsArchived,
          ),
          companyId: prismaCompanyId,
          personalNotes,
          emails: email.trim()
            ? [{ address: email.trim().toLowerCase(), type: "work", isPrimary: true }]
            : [],
          phoneNumbers: buildPhoneNumbers({ Phone: phone, Mobile: mobile }),
        },
      }),
    );

    return loadMappedContact(created.id);
  }

  const data: Record<string, unknown> = {};

  if (patch.FirstName !== undefined || patch.LastName !== undefined) {
    const firstName = patch.FirstName?.trim() ?? existing.firstName ?? "";
    const lastName = patch.LastName?.trim() ?? existing.lastName ?? "";
    data.firstName = firstName;
    data.lastName = lastName;
    data.fullName =
      patch.Title?.trim() || buildContactTitle(firstName, lastName) || existing.fullName;
  } else if (patch.Title !== undefined) {
    data.fullName = patch.Title.trim();
  }

  if (patch.JobTitle !== undefined || patch.Role !== undefined) {
    data.jobTitle = (patch.JobTitle?.trim() || patch.Role || existing.jobTitle || null) as
      | string
      | null;
  }

  if (patch.LinkedInURL !== undefined) {
    data.linkedInUrl = patch.LinkedInURL.trim() || null;
  }
  if (patch.buyingRole !== undefined) data.buyingRole = patch.buyingRole.trim() || null;
  if (patch.sentiment !== undefined) data.sentiment = patch.sentiment.trim() || null;
  if (patch.influenceLevel !== undefined) {
    data.influenceLevel = patch.influenceLevel.trim() || null;
  }
  if (patch.reportsToId !== undefined) {
    data.reportsToId = await resolvePrismaReportsToId(patch.reportsToId) || null;
  }
  if (patch.city !== undefined) data.city = patch.city.trim() || null;
  if (patch.country !== undefined) data.country = patch.country.trim() || null;
  if (patch.timezone !== undefined) data.timezone = patch.timezone.trim() || null;
  if (patch.isTimezoneOverridden !== undefined) {
    data.isTimezoneOverridden = patch.isTimezoneOverridden;
  }
  if (patch.engagementCadence !== undefined) {
    data.engagementCadence = patch.engagementCadence.trim() || null;
  }
  if (patch.backgroundNotes !== undefined) {
    data.backgroundNotes = patch.backgroundNotes.trim() || null;
  }
  if (patch.preferredLanguage !== undefined) {
    data.preferredLanguage = patch.preferredLanguage.trim() || null;
  }

  if (patch.Status !== undefined || patch.IsArchived !== undefined) {
    data.status = toPrismaContactStatus(patch.Status, patch.IsArchived);
  }

  if (patch.Email !== undefined) {
    data.emails = patch.Email.trim()
      ? [{ address: patch.Email.trim().toLowerCase(), type: "work", isPrimary: true }]
      : [];
  }

  if (patch.Phone !== undefined || patch.Mobile !== undefined) {
    data.phoneNumbers = buildPhoneNumbers({
      Phone: patch.Phone ?? undefined,
      Mobile: patch.Mobile ?? undefined,
    });
  }

  if (
    patch.Role !== undefined ||
    patch.RelationshipLevel !== undefined ||
    patch.EmploymentStatus !== undefined
  ) {
    data.personalNotes = serializeContactMeta(existing.personalNotes, patch);
  }

  if (patch.Company) {
    const companyRef =
      "CompanyID" in patch.Company ? patch.Company.CompanyID : patch.Company.Id;
    const companyId = await resolvePrismaCompanyId(companyRef);
    if (companyId) data.companyId = companyId;
  }

  const updated = await withPrismaRetry(async (prisma) =>
    prisma.contact.update({
      where: { id: existing.id },
      data,
    }),
  );

  return loadMappedContact(updated.id);
}

export async function deleteRegistryContact(id: string | number): Promise<boolean> {
  if (!(await prismaRegistryAvailable())) return false;
  const existing = await findPrismaContactByIdOrEmail(String(id));
  if (!existing) return false;

  await withPrismaRetry((prisma) =>
    prisma.contact.update({
      where: { id: existing.id },
      data: { status: "archived" },
    }),
  );
  return true;
}
