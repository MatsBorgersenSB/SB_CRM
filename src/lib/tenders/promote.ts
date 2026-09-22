import "server-only";

import type { Prisma } from "@/generated/prisma";
import { normalizeCompanyDomain } from "@/lib/company-domain";
import { toStoredCompanyTypes } from "@/lib/company-classification";
import { normalizeCompanySectors } from "@/lib/company-sectors";
import { allocateNextCompanyCode } from "@/lib/data/companies";
import { allocateNextOpportunityCode } from "@/lib/data/opportunities";
import {
  getContinentByCountryCode,
  resolveCountry,
} from "@/lib/geo/country-continent";
import { canonicalizeCompanyType, type CompanyType } from "@/types/company-type";
import { getPrisma } from "@/lib/prisma";
import { TENDER_SELECT } from "@/lib/tenders/types";
import { scheduleOpportunitySharePointFolderProvision } from "@/lib/m365/provision-opportunity-folder";

export type PromoteTenderResult = {
  tenderId: string;
  companyId: string;
  companyCreated: boolean;
  opportunityId: string;
  opportunityCode: string | null;
  stageLabel: "Tender / Pre-Feasibility";
};

const TENDER_PORTAL_HOSTS = new Set([
  "ted.europa.eu",
  "doffin.no",
  "mercell.com",
  "app.mercell.com",
  "sam.gov",
]);

function hostnameFromUrl(rawUrl: string | null): string | null {
  if (!rawUrl?.trim()) return null;
  const domain = normalizeCompanyDomain(rawUrl);
  if (!domain || domain.endsWith(".cn")) return null;
  if (TENDER_PORTAL_HOSTS.has(domain)) return null;
  return domain;
}

function formatDeadline(deadline: Date): string {
  return deadline.toISOString().slice(0, 10);
}

export async function promoteTenderToOpportunity(options: {
  tenderId: string;
  ownerId: string;
}): Promise<PromoteTenderResult> {
  const prisma = getPrisma();
  const tender = await prisma.tender.findUnique({
    where: { id: options.tenderId },
    select: TENDER_SELECT,
  });

  if (!tender) {
    throw Object.assign(new Error("Tender not found"), { status: 404 });
  }
  if (tender.status === "PROMOTED" && tender.promotedOpportunityId) {
    throw Object.assign(new Error("Tender is already promoted"), { status: 409 });
  }
  if (tender.status === "DISMISSED") {
    throw Object.assign(new Error("Dismissed tenders cannot be promoted"), { status: 409 });
  }
  if (tender.status === "EXPIRED" || tender.submissionDeadline.getTime() <= Date.now()) {
    throw Object.assign(new Error("Expired tenders cannot be promoted"), { status: 409 });
  }

  const domain = hostnameFromUrl(tender.rawUrl);
  const authorityName = tender.authorityName.trim();
  const countryResolved = resolveCountry(tender.country);

  const result = await prisma.$transaction(async (tx) => {
    const nameOrDomain: Prisma.CompanyWhereInput[] = [
      { name: { equals: authorityName, mode: "insensitive" } },
    ];
    if (domain) {
      nameOrDomain.push(
        { website: { equals: `https://${domain}`, mode: "insensitive" } },
        { website: { equals: `http://${domain}`, mode: "insensitive" } },
        { website: { equals: domain, mode: "insensitive" } },
      );
    }

    const existing = await tx.company.findFirst({
      where: { OR: nameOrDomain },
      select: {
        id: true,
        name: true,
        types: true,
        sectors: true,
        website: true,
      },
    });

    let companyId: string;
    let companyName: string;
    let companyCreated = false;

    if (existing) {
      companyId = existing.id;
      companyName = existing.name;
      const existingTypes = existing.types
        .map((value) => canonicalizeCompanyType(value))
        .filter((value): value is CompanyType => Boolean(value));
      const nextTypes = toStoredCompanyTypes([
        ...existingTypes,
        "Prospect",
      ]);
      const nextSectors = normalizeCompanySectors([
        ...existing.sectors,
        tender.sectorTag,
      ]);
      await tx.company.update({
        where: { id: existing.id },
        data: {
          types: nextTypes,
          companyType: nextTypes[0] ?? existing.types[0] ?? "Prospect",
          sectors: nextSectors,
          website: existing.website || (domain ? `https://${domain}` : undefined),
        },
        select: { id: true },
      });
    } else {
      const code = await allocateNextCompanyCode(tx);
      const created = await tx.company.create({
        data: {
          code,
          name: authorityName,
          website: domain ? `https://${domain}` : null,
          industry: "Other",
          sectors: normalizeCompanySectors([tender.sectorTag]),
          types: toStoredCompanyTypes(["Prospect", "Public / Government"]),
          companyType: "Prospect",
          status: "active",
          country: countryResolved?.name ?? tender.country,
          countryCode: countryResolved?.code ?? null,
          continent: countryResolved
            ? getContinentByCountryCode(countryResolved.code) || null
            : null,
          ownerId: options.ownerId,
        },
        select: { id: true, name: true },
      });
      companyId = created.id;
      companyName = created.name;
      companyCreated = true;
    }

    const opportunityCode = await allocateNextOpportunityCode(tx);
    const deadlineLabel = formatDeadline(tender.submissionDeadline);
    const description = [
      tender.summary,
      `Source: ${tender.source} (${tender.externalId}).`,
      tender.rawUrl ? `Notice: ${tender.rawUrl}` : null,
      `Technology: ${tender.technologyType}. Sector: ${tender.sectorTag}.`,
    ]
      .filter(Boolean)
      .join(" ");

    const opportunity = await tx.opportunity.create({
      data: {
        code: opportunityCode,
        name: tender.title,
        companyId,
        ownerId: options.ownerId,
        stage: "prospecting",
        status: "open",
        value: tender.estimatedBudget,
        currency: "EUR",
        probability: 15,
        expectedCloseDate: tender.submissionDeadline,
        companyRole: "Technology Buyer",
        offeringIds: [],
        description,
        nextStep: `Tender / Pre-Feasibility — submit before ${deadlineLabel}`,
        understanding: {
          origin: "thermal_tender",
          tenderId: tender.id,
          technologyType: tender.technologyType,
          sectorTag: tender.sectorTag,
          source: tender.source,
          externalId: tender.externalId,
        },
        team: [],
      },
      select: { id: true, code: true, name: true },
    });

    await tx.tender.update({
      where: { id: tender.id },
      data: {
        status: "PROMOTED",
        promotedCompanyId: companyId,
        promotedOpportunityId: opportunity.id,
      },
      select: { id: true },
    });

    return {
      tenderId: tender.id,
      companyId,
      companyCreated,
      companyName,
      opportunityId: opportunity.id,
      opportunityName: opportunity.name,
      opportunityCode: opportunity.code,
    };
  });

  scheduleOpportunitySharePointFolderProvision({
    opportunityId: result.opportunityId,
    companyName: result.companyName,
    opportunityTitle: result.opportunityName,
  });

  return {
    tenderId: result.tenderId,
    companyId: result.companyId,
    companyCreated: result.companyCreated,
    opportunityId: result.opportunityId,
    opportunityCode: result.opportunityCode,
    stageLabel: "Tender / Pre-Feasibility",
  };
}

export async function dismissTender(tenderId: string): Promise<{ id: string; status: "DISMISSED" }> {
  const prisma = getPrisma();
  const tender = await prisma.tender.findUnique({
    where: { id: tenderId },
    select: { id: true, status: true },
  });
  if (!tender) {
    throw Object.assign(new Error("Tender not found"), { status: 404 });
  }
  if (tender.status === "PROMOTED") {
    throw Object.assign(new Error("Promoted tenders cannot be dismissed"), { status: 409 });
  }

  await prisma.tender.update({
    where: { id: tenderId },
    data: { status: "DISMISSED" },
    select: { id: true },
  });

  return { id: tenderId, status: "DISMISSED" };
}
