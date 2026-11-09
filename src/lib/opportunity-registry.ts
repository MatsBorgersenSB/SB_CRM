import "server-only";

import type { CreateOpportunityInput } from "@/types/deal";
import type { PipelineRow, CompanyRole } from "@/types/pipeline";
import { COMPANY_ROLES, SALES_STAGE_IDS } from "@/types/pipeline";
import { registryStageFor } from "@/lib/sales-pipelines";
import { findPrismaCompanyByRouteKey } from "@/lib/resolve-company-route";
import { allocateNextOpportunityCode } from "@/lib/data/opportunities";
import { isPrismaConnectionError, withPrismaRetry } from "@/lib/prisma";
import { mapPrismaOpportunityToPipelineRow } from "@/lib/prisma-mappers";
import { scheduleOpportunitySharePointFolderProvision } from "@/lib/m365/provision-opportunity-folder";
import type { Prisma } from "@/generated/prisma";
import { isSalesMotion } from "@/types/sales-motion";
import { prismaLiveOpportunityWhere } from "@/lib/demo-seed-markers";

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

  const mapped = mapPrismaOpportunityToPipelineRow(created);
  await notifyOpportunityOwner(null, null, mapped, company.name);
  return mapped;
}

async function notifyOpportunityOwner(
  previousOwnerId: number | null,
  previousOwnerTitle: string | null,
  next: PipelineRow,
  companyName?: string | null,
): Promise<void> {
  const after = next.opportunityOwner;
  if (!after?.Id) return;
  try {
    const { notifyOwnershipAssigned } = await import(
      "@/lib/notifications/living-signals"
    );
    await notifyOwnershipAssigned({
      kind: "opportunity",
      entityId: next.code?.trim() || next.id,
      subject: next.assetName || next.code || next.id,
      assigneeId: after.Id,
      assigneeTitle: after.Title,
      previousOwnerId,
      previousOwnerTitle,
      companyName: companyName ?? null,
      dueDate: next.expectedCloseDate ?? null,
    });
  } catch (error) {
    console.warn(
      "[opportunity] owner assign notify failed",
      error instanceof Error ? error.message : error,
    );
  }
}

export async function getRegistryOpportunity(
  id: string,
): Promise<PipelineRow | null> {
  if (!(await prismaRegistryAvailable())) return null;

  try {
    const { findPrismaOpportunityByRouteKey } = await import(
      "@/lib/resolve-opportunity-route"
    );
    const existing = await findPrismaOpportunityByRouteKey(id);
    if (!existing) return null;
    return mapPrismaOpportunityToPipelineRow(existing);
  } catch {
    return null;
  }
}

export async function listRegistryOpportunities(): Promise<PipelineRow[] | null> {
  if (!(await prismaRegistryAvailable())) return null;

  const rows = await withPrismaRetry((prisma) =>
    prisma.opportunity.findMany({
      where: {
        status: { in: ["open", "on_hold"] },
        AND: prismaLiveOpportunityWhere.AND,
      },
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

  const { findPrismaOpportunityByRouteKey } = await import(
    "@/lib/resolve-opportunity-route"
  );
  const existing = await findPrismaOpportunityByRouteKey(id);
  if (!existing) return null;

  const previousOwnerId =
    existing.ownerId && existing.ownerId !== "system" && Number.isFinite(Number(existing.ownerId))
      ? Number(existing.ownerId)
      : null;

  const data: Prisma.OpportunityUpdateInput = {};

  if (patch.assetName !== undefined) {
    const name = patch.assetName.trim();
    if (name) data.name = name;
  }
  if (patch.salesStageId !== undefined && SALES_STAGE_IDS.includes(patch.salesStageId)) {
    const { stage, status } = registryStageFor(patch.salesStageId);
    data.stage = stage;
    data.status = status;
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
  if (patch.dealModel !== undefined) {
    // null clears the choice; anything else must be a known deal model.
    if (patch.dealModel === null) data.dealModel = null;
    else if (isSalesMotion(patch.dealModel)) data.dealModel = patch.dealModel;
  }
  if (patch.currentMilestone !== undefined) {
    data.nextStep = patch.currentMilestone.trim() || null;
  }
  if (patch.team !== undefined || patch.linkedCompanyIds !== undefined) {
    const existingRawTeam = Array.isArray(existing.team) ? existing.team : [];
    const existingCompanyEntries = existingRawTeam.filter((entry) => {
      if (!entry || typeof entry !== "object") return false;
      const row = entry as { contactId?: unknown; companyId?: unknown };
      const hasContact = typeof row.contactId === "string" && row.contactId.trim().length > 0;
      const hasCompany = typeof row.companyId === "string" && row.companyId.trim().length > 0;
      return !hasContact && hasCompany;
    }) as Prisma.InputJsonValue[];

    const contactEntries: Prisma.InputJsonValue[] =
      patch.team !== undefined
        ? patch.team.map((member) => ({
            contactId: member.contactId,
            projectRole: member.projectRole,
            ...(member.companyId ? { companyId: member.companyId } : {}),
          }))
        : (existingRawTeam.filter((entry) => {
            if (!entry || typeof entry !== "object") return false;
            const row = entry as { contactId?: unknown };
            return typeof row.contactId === "string" && row.contactId.trim().length > 0;
          }) as Prisma.InputJsonValue[]);

    const companyEntries: Prisma.InputJsonValue[] =
      patch.linkedCompanyIds !== undefined
        ? patch.linkedCompanyIds
            .map((id) => id.trim())
            .filter(Boolean)
            .map((companyId) => ({
              companyId,
              contactId: "",
              projectRole: "Associated Organization",
            }))
        : existingCompanyEntries;

    data.team = [...contactEntries, ...companyEntries];
  }
  if (patch.understanding !== undefined) {
    data.understanding = patch.understanding as Prisma.InputJsonValue;
  }
  if (patch.opportunityOwner?.Id != null) {
    data.ownerId = String(patch.opportunityOwner.Id);
  }

  if (Object.keys(data).length === 0) {
    return loadMappedOpportunity(existing.id);
  }

  await withPrismaRetry((prisma) =>
    prisma.opportunity.update({
      where: { id: existing.id },
      data,
    }),
  );

  const mapped = await loadMappedOpportunity(existing.id);
  if (patch.opportunityOwner !== undefined) {
    await notifyOpportunityOwner(
      previousOwnerId,
      null,
      mapped,
      existing.company?.name ?? null,
    );
  }
  return mapped;
}

export async function deleteRegistryOpportunity(
  id: string | number,
): Promise<boolean> {
  if (!(await prismaRegistryAvailable())) return false;

  const { findPrismaOpportunityByRouteKey } = await import(
    "@/lib/resolve-opportunity-route"
  );
  const existing = await findPrismaOpportunityByRouteKey(String(id));
  if (!existing) return false;

  if (existing.status === "archived") return true;

  await withPrismaRetry((prisma) =>
    prisma.opportunity.update({
      where: { id: existing.id },
      data: { status: "archived" },
    }),
  );
  return true;
}

/**
 * Connect an existing company (any posture: customer, supplier, partner, consultant)
 * to an existing opportunity without overwriting the opportunity's primary customer companyId.
 */
export async function linkCompanyToRegistryOpportunity(
  companyRouteKey: string,
  opportunityRouteKey: string,
): Promise<PipelineRow | null> {
  if (!(await prismaRegistryAvailable())) return null;

  const { findPrismaOpportunityByRouteKey } = await import(
    "@/lib/resolve-opportunity-route"
  );
  const [company, opportunity] = await Promise.all([
    findPrismaCompanyByRouteKey(companyRouteKey),
    findPrismaOpportunityByRouteKey(opportunityRouteKey),
  ]);
  if (!opportunity) return null;

  const canonicalCompanyCode =
    company?.code?.trim() || company?.id || companyRouteKey.trim();
  if (!canonicalCompanyCode) return loadMappedOpportunity(opportunity.id);

  const existingRawTeam = Array.isArray(opportunity.team) ? opportunity.team : [];
  const alreadyLinked =
    (company && opportunity.companyId === company.id) ||
    existingRawTeam.some((entry) => {
      if (!entry || typeof entry !== "object") return false;
      const cid = (entry as { companyId?: unknown }).companyId;
      if (typeof cid !== "string") return false;
      const norm = cid.trim().toUpperCase();
      return (
        norm === canonicalCompanyCode.toUpperCase() ||
        (company?.id ? norm === company.id.toUpperCase() : false) ||
        (company?.code ? norm === company.code.trim().toUpperCase() : false)
      );
    });

  if (!alreadyLinked) {
    const nextTeam: Prisma.InputJsonValue[] = [
      ...(existingRawTeam as Prisma.InputJsonValue[]),
      {
        companyId: canonicalCompanyCode,
        ...(company?.id && company.id !== canonicalCompanyCode
          ? { prismaCompanyId: company.id }
          : {}),
        contactId: "",
        projectRole: "Associated Organization",
      },
    ];
    await withPrismaRetry((prisma) =>
      prisma.opportunity.update({
        where: { id: opportunity.id },
        data: { team: nextTeam },
      }),
    );
  }

  return loadMappedOpportunity(opportunity.id);
}
