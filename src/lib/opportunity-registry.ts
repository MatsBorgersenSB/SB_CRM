import "server-only";

import type { CreateOpportunityInput } from "@/types/deal";
import type { PipelineRow, CompanyRole } from "@/types/pipeline";
import { COMPANY_ROLES } from "@/types/pipeline";
import { findPrismaCompanyByRouteKey } from "@/lib/resolve-company-route";
import { allocateNextOpportunityCode } from "@/lib/data/opportunities";
import { isPrismaConnectionError, withPrismaRetry } from "@/lib/prisma";
import { mapPrismaOpportunityToPipelineRow } from "@/lib/prisma-mappers";
import { scheduleOpportunitySharePointFolderProvision } from "@/lib/m365/provision-opportunity-folder";
import type { Prisma } from "@/generated/prisma";

async function prismaRegistryAvailable(): Promise<boolean> {
  try {
    await withPrismaRetry((prisma) =>
      prisma.opportunity.findFirst({ select: { id: true } }),
    );
    return true;
  } catch (error) {
    if (!isPrismaConnectionError(error)) {
      console.warn(
        "[opportunity-registry] Prisma unavailable:",
        error instanceof Error ? error.message : error,
      );
    }
    return false;
  }
}

const opportunityInclude = {
  company: { select: { id: true, name: true } },
} as const;

async function loadMappedOpportunity(id: string): Promise<PipelineRow> {
  const row = await withPrismaRetry((prisma) =>
    prisma.opportunity.findUniqueOrThrow({
      where: { id },
      include: opportunityInclude,
    }),
  );
  return mapPrismaOpportunityToPipelineRow(row);
}

function parseCloseDate(raw: string | undefined): Date | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const date = new Date(`${trimmed}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function createRegistryOpportunity(
  input: CreateOpportunityInput,
  ownerId = "system",
): Promise<PipelineRow | null> {
  if (!(await prismaRegistryAvailable())) return null;

  const company = await findPrismaCompanyByRouteKey(input.companyId);
  if (!company) return null;

  const assetName = input.assetName.trim();
  if (!assetName) return null;

  const offeringIds = (input.offeringIds ?? [])
    .map((id) => id.trim())
    .filter(Boolean);
  if (offeringIds.length === 0) return null;

  const companyRole: CompanyRole = COMPANY_ROLES.includes(input.companyRole)
    ? input.companyRole
    : "Technology Buyer";

  const salesValue =
    typeof input.salesValue === "number" && Number.isFinite(input.salesValue)
      ? Math.max(0, input.salesValue)
      : 0;
  const expectedCloseDate = parseCloseDate(input.expectedCloseDate);
  const currency = (input.currency?.trim().toUpperCase() || "EUR").slice(0, 8);
  const code = await allocateNextOpportunityCode();

  const created = await withPrismaRetry((prisma) =>
    prisma.opportunity.create({
      data: {
        code,
        name: assetName,
        companyId: company.id,
        ownerId: String(ownerId || "system"),
        stage: "prospecting",
        status: "open",
        value: salesValue > 0 ? salesValue : null,
        currency,
        probability: salesValue > 0 ? 15 : 10,
        expectedCloseDate,
        companyRole,
        offeringIds,
        nextStep: "Opportunity opened",
        team: [],
      },
      include: opportunityInclude,
    }),
  );

  scheduleOpportunitySharePointFolderProvision({
    opportunityId: created.id,
    companyName: company.name,
    opportunityTitle: assetName,
  });

  return mapPrismaOpportunityToPipelineRow(created);
}

export async function getRegistryOpportunity(
  id: string,
): Promise<PipelineRow | null> {
  if (!(await prismaRegistryAvailable())) return null;

  try {
    return await loadMappedOpportunity(id);
  } catch {
    return null;
  }
}

export async function listRegistryOpportunities(): Promise<PipelineRow[] | null> {
  if (!(await prismaRegistryAvailable())) return null;

  const rows = await withPrismaRetry((prisma) =>
    prisma.opportunity.findMany({
      where: { status: { in: ["open", "on_hold"] } },
      include: opportunityInclude,
      orderBy: { updatedAt: "desc" },
    }),
  );

  return rows.map(mapPrismaOpportunityToPipelineRow);
}

export async function updateRegistryOpportunity(
  id: string,
  patch: Partial<PipelineRow>,
): Promise<PipelineRow | null> {
  if (!(await prismaRegistryAvailable())) return null;

  const existing = await withPrismaRetry((prisma) =>
    prisma.opportunity.findUnique({ where: { id }, select: { id: true } }),
  );
  if (!existing) return null;

  const data: Prisma.OpportunityUpdateInput = {};

  if (patch.assetName !== undefined) {
    const name = patch.assetName.trim();
    if (name) data.name = name;
  }
  if (patch.salesValue !== undefined && Number.isFinite(patch.salesValue)) {
    data.value = Math.max(0, patch.salesValue);
  }
  if (patch.currency !== undefined) {
    data.currency = String(patch.currency).trim().toUpperCase().slice(0, 8) || "EUR";
  }
  if (patch.probability !== undefined && Number.isFinite(patch.probability)) {
    data.probability = Math.min(100, Math.max(0, Math.round(patch.probability)));
  }
  if (patch.expectedCloseDate !== undefined) {
    data.expectedCloseDate = parseCloseDate(patch.expectedCloseDate);
  }
  if (patch.companyRole !== undefined && COMPANY_ROLES.includes(patch.companyRole)) {
    data.companyRole = patch.companyRole;
  }
  if (patch.offeringIds !== undefined) {
    data.offeringIds = patch.offeringIds.map((entry) => entry.trim()).filter(Boolean);
  }
  if (patch.currentMilestone !== undefined) {
    data.nextStep = patch.currentMilestone.trim() || null;
  }
  if (patch.team !== undefined) {
    data.team = patch.team.map((member) => ({
      contactId: member.contactId,
      projectRole: member.projectRole,
    })) as Prisma.InputJsonValue[];
  }
  if (patch.opportunityOwner?.Id != null) {
    data.ownerId = String(patch.opportunityOwner.Id);
  }

  if (Object.keys(data).length === 0) {
    return loadMappedOpportunity(id);
  }

  await withPrismaRetry((prisma) =>
    prisma.opportunity.update({
      where: { id },
      data,
    }),
  );

  return loadMappedOpportunity(id);
}
