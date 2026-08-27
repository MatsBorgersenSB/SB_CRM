import "server-only";

import { findPrismaCompanyByRouteKey } from "@/lib/resolve-company-route";
import { withPrismaRetry } from "@/lib/prisma";
import type { CompanyMergeResult } from "@/lib/duplicate-management/types";
import {
  allEmailsFromJson,
  normalizeOrgNumber,
  normalizeVatNumber,
} from "@/lib/duplicate-management/normalize";

function unionStrings(a: string[], b: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of [...a, ...b]) {
    const key = value.trim();
    if (!key) continue;
    const lower = key.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    out.push(key);
  }
  return out;
}

function preferFilled<T>(primary: T, secondary: T): T {
  if (primary === null || primary === undefined || primary === "") return secondary;
  return primary;
}

function preferFilledArray(primary: unknown, secondary: unknown): object[] {
  const a = Array.isArray(primary) ? (primary as object[]) : [];
  const b = Array.isArray(secondary) ? (secondary as object[]) : [];
  return a.length > 0 ? a : b;
}

/**
 * Merge secondary company into primary, remap children, archive secondary.
 * ADMIN must confirm — never auto-called.
 */
export async function mergeCompanies(
  primaryKey: string,
  secondaryKey: string,
): Promise<CompanyMergeResult> {
  if (primaryKey.trim() === secondaryKey.trim()) {
    throw new Error("Cannot merge a company with itself");
  }

  const primaryRef = await findPrismaCompanyByRouteKey(primaryKey);
  const secondaryRef = await findPrismaCompanyByRouteKey(secondaryKey);
  if (!primaryRef || !secondaryRef) {
    throw new Error("One or both companies were not found");
  }
  if (primaryRef.id === secondaryRef.id) {
    throw new Error("Cannot merge a company with itself");
  }

  return withPrismaRetry(async (prisma) => {
    const [primary, secondary] = await Promise.all([
      prisma.company.findUniqueOrThrow({ where: { id: primaryRef.id } }),
      prisma.company.findUniqueOrThrow({ where: { id: secondaryRef.id } }),
    ]);

    if (primary.status !== "active") {
      throw new Error("Primary company must be active");
    }
    if (secondary.status !== "active") {
      throw new Error("Secondary company is already archived");
    }

    const primaryOrg = normalizeOrgNumber(primary.organizationNumber);
    const secondaryOrg = normalizeOrgNumber(secondary.organizationNumber);
    if (primaryOrg && secondaryOrg && primaryOrg !== secondaryOrg) {
      throw new Error(
        "Cannot merge companies with different organization numbers — they are different legal entities",
      );
    }

    const primaryVat = normalizeVatNumber(primary.vatNumber);
    const secondaryVat = normalizeVatNumber(secondary.vatNumber);
    if (primaryVat && secondaryVat && primaryVat !== secondaryVat) {
      throw new Error(
        "Cannot merge companies with different VAT numbers — they are different legal entities",
      );
    }

    const primaryContacts = await prisma.contact.findMany({
      where: { companyId: primary.id, status: "active" },
      select: { id: true, emails: true },
    });
    const primaryEmailSet = new Set(
      primaryContacts.flatMap((c) => allEmailsFromJson(c.emails)),
    );

    const secondaryContacts = await prisma.contact.findMany({
      where: { companyId: secondary.id },
      select: { id: true, emails: true, status: true },
    });

    return prisma.$transaction(async (tx) => {
      let contactsMoved = 0;
      let contactsArchived = 0;

      for (const contact of secondaryContacts) {
        const emails = allEmailsFromJson(contact.emails);
        const collides = emails.some((email) => primaryEmailSet.has(email));
        if (collides && contact.status === "active") {
          await tx.contact.update({
            where: { id: contact.id },
            data: { status: "archived", companyId: primary.id },
          });
          contactsArchived += 1;
          continue;
        }
        await tx.contact.update({
          where: { id: contact.id },
          data: { companyId: primary.id },
        });
        contactsMoved += 1;
        for (const email of emails) primaryEmailSet.add(email);
      }

      const opps = await tx.opportunity.updateMany({
        where: { companyId: secondary.id },
        data: { companyId: primary.id },
      });

      const notes = await tx.companyNote.updateMany({
        where: { companyId: secondary.id },
        data: { companyId: primary.id },
      });

      const documents = await tx.documentRecord.updateMany({
        where: { companyId: secondary.id },
        data: { companyId: primary.id },
      });

      const meetings = await tx.meetingRecord.updateMany({
        where: { companyId: secondary.id },
        data: { companyId: primary.id },
      });

      await tx.accountHealthRecord.updateMany({
        where: { companyId: secondary.id },
        data: { companyId: primary.id },
      });

      await tx.expansionSignal.updateMany({
        where: { companyId: secondary.id },
        data: { companyId: primary.id },
      });

      await tx.workflowExecution.updateMany({
        where: { companyId: secondary.id },
        data: { companyId: primary.id },
      });

      await tx.company.updateMany({
        where: { parentCompanyId: secondary.id },
        data: { parentCompanyId: primary.id },
      });

      const mergedTypes = unionStrings(
        [...(primary.types ?? []), primary.companyType ?? ""],
        [...(secondary.types ?? []), secondary.companyType ?? ""],
      );

      await tx.company.update({
        where: { id: primary.id },
        data: {
          types: mergedTypes.length > 0 ? mergedTypes : primary.types,
          companyType: preferFilled(primary.companyType, secondary.companyType),
          organizationNumber: preferFilled(
            primary.organizationNumber,
            secondary.organizationNumber,
          ),
          vatNumber: preferFilled(primary.vatNumber, secondary.vatNumber),
          website: preferFilled(primary.website, secondary.website),
          industry: preferFilled(primary.industry, secondary.industry),
          ownerId: preferFilled(primary.ownerId, secondary.ownerId),
          addressLine1: preferFilled(primary.addressLine1, secondary.addressLine1),
          addressLine2: preferFilled(primary.addressLine2, secondary.addressLine2),
          postalCode: preferFilled(primary.postalCode, secondary.postalCode),
          city: preferFilled(primary.city, secondary.city),
          stateRegion: preferFilled(primary.stateRegion, secondary.stateRegion),
          country: preferFilled(primary.country, secondary.country),
          countryCode: preferFilled(primary.countryCode, secondary.countryCode),
          continent: preferFilled(primary.continent, secondary.continent),
          emails: preferFilledArray(primary.emails, secondary.emails),
          phoneNumbers: preferFilledArray(primary.phoneNumbers, secondary.phoneNumbers),
          alternativeNames: unionStrings(primary.alternativeNames ?? [], [
            ...(secondary.alternativeNames ?? []),
            secondary.name !== primary.name ? secondary.name : "",
          ]),
          sectors: unionStrings(primary.sectors ?? [], secondary.sectors ?? []),
        },
      });

      await tx.company.update({
        where: { id: secondary.id },
        data: {
          status: "archived",
          organizationNumber: null,
          vatNumber: null,
          parentCompanyId:
            secondary.parentCompanyId === primary.id ? null : secondary.parentCompanyId,
        },
      });

      return {
        primaryId: primary.id,
        primaryCode: primary.code?.trim() || primary.id,
        secondaryId: secondary.id,
        secondaryCode: secondary.code?.trim() || secondary.id,
        remapped: {
          contacts: contactsMoved,
          contactsArchivedAsDuplicates: contactsArchived,
          opportunities: opps.count,
          notes: notes.count,
          documents: documents.count,
          meetings: meetings.count,
        },
      } satisfies CompanyMergeResult;
    });
  });
}
