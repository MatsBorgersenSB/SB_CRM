import { NextResponse } from "next/server";
import { resolveRequestRole } from "@/lib/api-auth";
import { m365Error } from "@/lib/m365/api-response";
import { scheduleOpportunitySharePointFolderProvision } from "@/lib/m365/provision-opportunity-folder";
import { canCreateOpportunity } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import {
  clientIpFromRequest,
  logAuditEvent,
  resolveAuditActor,
} from "@/lib/security/audit-logger";
import { getServerSharePointServices } from "@/services/sharepoint/factory";
import { SharePointServiceError } from "@/services/sharepoint/client/errors";
import { sharePointErrorResponse } from "@/services/sharepoint/server/api-utils";
import type { CreateOpportunityInput } from "@/types/deal";
import { COMPANY_ROLES, type CompanyRole } from "@/types/pipeline";

type AddOpportunityBody = {
  companyId?: string;
  title?: string;
  companyRole?: string;
  offeringIds?: string[];
  salesValue?: number | null;
  currency?: string;
  expectedCloseDate?: string;
};

/**
 * Create an opportunity from Outlook Relationship Card (user-confirmed).
 * Same portfolio + registry path as the web create flow — no separate store.
 */
export async function POST(request: Request) {
  const role = await resolveRequestRole(request);
  if (!canCreateOpportunity(role)) {
    return m365Error("You do not have permission to create opportunities.", 403);
  }

  let body: AddOpportunityBody;
  try {
    body = (await request.json()) as AddOpportunityBody;
  } catch {
    return m365Error("Invalid request body", 400);
  }

  const companyId = body.companyId?.trim() ?? "";
  const title = body.title?.trim() ?? "";
  const companyRole = body.companyRole?.trim() ?? "";
  const offeringIds = Array.isArray(body.offeringIds)
    ? body.offeringIds.map((id) => id.trim()).filter(Boolean)
    : [];

  if (!companyId) return m365Error("companyId is required", 400);
  if (!title) return m365Error("Opportunity name is required", 400);
  if (!COMPANY_ROLES.includes(companyRole as CompanyRole)) {
    return m365Error("companyRole is required", 400);
  }
  if (offeringIds.length === 0) {
    return m365Error("Select at least one Standard Bio offering", 400);
  }

  const actor = resolveAuditActor(request, role);
  const salesValue =
    typeof body.salesValue === "number" && Number.isFinite(body.salesValue)
      ? Math.max(0, body.salesValue)
      : undefined;

  try {
    const { companies, deals } = getServerSharePointServices();
    const company = await companies.getById(companyId);
    const companyName = company.Title;

    const dealInput: CreateOpportunityInput = {
      companyId,
      assetName: title,
      companyRole: companyRole as CompanyRole,
      offeringIds,
      ...(salesValue !== undefined ? { salesValue } : {}),
      ...(body.expectedCloseDate?.trim()
        ? { expectedCloseDate: body.expectedCloseDate.trim() }
        : {}),
      ...(body.currency
        ? { currency: body.currency as CreateOpportunityInput["currency"] }
        : {}),
    };

    const deal = await deals.create(dealInput);

    await logAuditEvent({
      ...actor,
      action: "DEAL_CREATED",
      entityType: "Deal",
      entityId: deal.id,
      ipAddress: clientIpFromRequest(request),
      metadata: {
        assetName: deal.assetName,
        companyId,
        source: "outlook-addin",
      },
    });

    let opportunityId: string | null = null;
    try {
      const prisma = getPrisma();
      const prismaCompany = await prisma.company.findFirst({
        where: {
          OR: [
            { id: companyId },
            { name: { equals: companyName, mode: "insensitive" } },
          ],
        },
        select: { id: true },
      });
      if (prismaCompany) {
        const opportunity = await prisma.opportunity.create({
          data: {
            name: title,
            companyId: prismaCompany.id,
            ownerId: String(actor.userId || "system"),
            value: salesValue ?? null,
            stage: "prospecting",
            currency: body.currency?.trim() || "EUR",
          },
        });
        opportunityId = opportunity.id;
        scheduleOpportunitySharePointFolderProvision({
          opportunityId: opportunity.id,
          companyName,
          opportunityTitle: title,
        });
      }
    } catch (registryError) {
      console.warn(
        "[outlook add-opportunity] Prisma registry sync skipped:",
        registryError,
      );
    }

    return NextResponse.json(
      {
        ok: true,
        dealId: deal.id,
        opportunityId,
        title: deal.assetName,
        companyId,
        companyName,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof SharePointServiceError) {
      return sharePointErrorResponse(error);
    }
    const message =
      error instanceof Error ? error.message : "Unable to create opportunity";
    return m365Error(message, 500);
  }
}
