import "server-only";

import { allocateNextCompanyCode } from "@/lib/data/companies";
import { normalizeCompanyDomain } from "@/lib/company-domain";
import { resolveAccountOwner } from "@/lib/company-owner";
import { isInternalEmail } from "@/lib/domain-rules";
import { normalizePhoneNumber } from "@/lib/m365/phone-normalization";
import { withPrismaRetry } from "@/lib/prisma";
import { normalizeCompanyName } from "@/lib/smartassist/explore/company-explore";
import type {
  CompanyExploration,
  ExploreImportRequest,
  ExploreImportResult,
  ExplorePerson,
} from "@/lib/smartassist/explore/types";
import { company360Href } from "@/types/company-360";

const LEGAL_SUFFIXES = new Set(["AS", "ASA", "SA", "DA", "ANS", "BA", "KS", "NUF", "AB", "OY", "OYJ", "APS", "A/S", "GMBH", "AG", "BV", "NV", "SE"]);

/** Registers shout ("ROMERIKE BIOGASSANLEGG AS"); people don't. */
export function displayCompanyName(legalName: string): string {
  const trimmed = legalName.trim().replace(/\s+/g, " ");
  if (!trimmed) return trimmed;
  const isShouting = trimmed === trimmed.toUpperCase() && /[A-ZÆØÅ]/.test(trimmed);
  if (!isShouting) return trimmed;
  return trimmed
    .split(" ")
    .map((word) => {
      if (LEGAL_SUFFIXES.has(word)) return word;
      if (/^\d/.test(word)) return word;
      return word
        .toLowerCase()
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join("-");
    })
    .join(" ");
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "Contact", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0]!, lastName: "" };
  return { firstName: parts[0]!, lastName: parts.slice(1).join(" ") };
}

function contactData(person: ExplorePerson) {
  const { firstName, lastName } = splitName(person.name);
  const email = person.email?.trim().toLowerCase() ?? "";
  const phone = person.phone ? normalizePhoneNumber(person.phone) : "";
  return {
    firstName,
    lastName,
    fullName: person.name.trim(),
    jobTitle: person.role.trim() || null,
    status: "active" as const,
    emails: email ? [{ address: email, type: "work", isPrimary: true }] : [],
    phoneNumbers: phone ? [{ number: phone, type: "mobile", isPrimary: true }] : [],
  };
}

function websiteUrl(exploration: CompanyExploration): string | null {
  const raw = exploration.found.website?.url || exploration.found.registry?.website || "";
  const domain = normalizeCompanyDomain(raw);
  return domain ? `https://${domain}` : null;
}

/**
 * Creates the company (and the chosen people) from an exploration the user approved.
 * Nothing here runs without that approval; the relationship type is the user's call.
 */
export async function importExploration(
  request: ExploreImportRequest,
  actor: { email: string | null },
): Promise<ExploreImportResult> {
  const { exploration, companyType } = request;
  const registry = exploration.found.registry;
  const name = displayCompanyName(registry?.legalName ?? exploration.subject);
  const owner = resolveAccountOwner(request.accountOwner);
  const site = websiteUrl(exploration);
  const domain = site ? normalizeCompanyDomain(site) : "";
  const selected = new Set(request.selectedPeopleIds);
  const people = exploration.found.people.filter((p) => selected.has(p.id));
  const authorId = actor.email?.trim() || owner.Title || "smartassist";

  return withPrismaRetry((prisma) =>
    prisma.$transaction(async (tx) => {
      // Never create a second record for a company we already hold.
      const candidates = await tx.company.findMany({
        where: {
          OR: [
            ...(registry ? [{ organizationNumber: registry.registrationNumber }] : []),
            ...(domain ? [{ website: { contains: domain, mode: "insensitive" as const } }] : []),
            { name: { equals: name, mode: "insensitive" as const } },
          ],
        },
        select: { id: true, code: true, name: true, website: true },
      });
      const existing =
        candidates.find((c) => normalizeCompanyName(c.name) === normalizeCompanyName(name)) ??
        candidates[0] ??
        null;

      let companyId: string;
      let code: string | null;
      let created = false;

      if (existing) {
        companyId = existing.id;
        code = existing.code;
      } else {
        created = true;
        code = await allocateNextCompanyCode(tx);
        const emails = exploration.found.website?.email
          ? [{ address: exploration.found.website.email.toLowerCase(), type: "work", isPrimary: true }]
          : [];
        const phones = exploration.found.website?.phone
          ? [{ number: normalizePhoneNumber(exploration.found.website.phone), type: "office", isPrimary: true }]
          : [];
        const company = await tx.company.create({
          data: {
            code,
            name,
            website: site,
            industry: registry?.industryDescription ?? null,
            types: [companyType],
            companyType,
            status: "active",
            addressLine1: registry?.streetAddress ?? null,
            postalCode: registry?.postalCode ?? null,
            city: registry?.city ?? null,
            country: registry?.country ?? null,
            countryCode: registry?.countryCode ?? null,
            continent: "Europe",
            organizationNumber: registry?.registrationNumber ?? null,
            vatNumber: registry?.vatNumber ?? null,
            ownerId: String(owner.Id),
            emails,
            phoneNumbers: phones,
            size: "unknown",
          },
          select: { id: true },
        });
        companyId = company.id;

        const sourceLabels = exploration.sources
          .filter((s) => s.kind !== "crm")
          .map((s) => s.label)
          .join(", ");
        await tx.companyNote.create({
          data: {
            companyId,
            authorId,
            content: `Added by SmartAssist from the question "${exploration.question}". Sources: ${sourceLabels || "none"}. Relationship type chosen by ${owner.Title}: ${companyType}.`,
          },
        });
      }

      const existingContacts = await tx.contact.findMany({
        where: { companyId, status: "active" },
        select: { fullName: true, firstName: true, lastName: true, emails: true },
      });
      const haveName = new Set(
        existingContacts.map((c) =>
          (c.fullName ?? `${c.firstName ?? ""} ${c.lastName ?? ""}`).trim().toLowerCase(),
        ),
      );

      let peopleImported = 0;
      let peopleSkipped = 0;
      for (const person of people) {
        if (person.email && isInternalEmail(person.email)) {
          peopleSkipped += 1;
          continue;
        }
        if (haveName.has(person.name.trim().toLowerCase())) {
          peopleSkipped += 1;
          continue;
        }
        await tx.contact.create({ data: { ...contactData(person), companyId, ownerId: String(owner.Id) } });
        haveName.add(person.name.trim().toLowerCase());
        peopleImported += 1;
      }

      return {
        companyId,
        href: company360Href({ code, id: companyId }),
        created,
        peopleImported,
        peopleSkipped,
      };
    }),
  );
}
