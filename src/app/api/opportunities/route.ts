import { NextResponse } from "next/server";
import { getRequestRole } from "@/lib/api-auth";
import { canCreateOpportunity } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import {
  clientIpFromRequest,
  logAuditEvent,
  resolveAuditActor,
} from "@/lib/security/audit-logger";
import { scheduleOpportunitySharePointFolderProvision } from "@/lib/m365/provision-opportunity-folder";
import { SharePointServiceError } from "@/services/sharepoint/client/errors";
import { sharePointErrorResponse } from "@/services/sharepoint/server/api-utils";
import { checkOpportunityDuplicate } from "@/lib/validation/deduplication";
import type { OpportunityStage } from "@/generated/prisma";

const OPPORTUNITY_STAGES = new Set<string>([
  "prospecting",
  "qualification",
  "discovery",
  "proposal",
  "negotiation",
  "commitment",
  "closed_won",
  "closed_lost",
]);

type CreateOpportunityBody = {
  title?: string;
  name?: string;
  companyId?: string;
  companyName?: string;
  value?: number | null;
  stage?: string;
  ownerId?: string;
  currency?: string;
  description?: string;
};

function resolveStage(raw: string | undefined): OpportunityStage {
  if (raw && OPPORTUNITY_STAGES.has(raw)) {
    return raw as OpportunityStage;
  }
  return "prospecting";
}

/**
 * Prisma-first opportunity create (registry), then non-blocking SharePoint folder provision.
 * SharePoint Online remains the document SSO; Postgres remains the commercial record SSO.
 */
export async function POST(request: Request) {
  const role = getRequestRole(request);
  if (!canCreateOpportunity(role)) {
    return sharePointErrorResponse(
      SharePointServiceError.forbidden("Insufficient role to create opportunities"),
    );
  }

  let body: CreateOpportunityBody;
  try {
    body = (await request.json()) as CreateOpportunityBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const title = (body.title ?? body.name ?? "").trim();
  const companyId = (body.companyId ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "title (or name) is required" }, { status: 400 });
  }
  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  const actor = resolveAuditActor(request, role);
  const ownerId = (body.ownerId ?? actor.userId ?? "system").trim() || "system";

  try {
    const prisma = getPrisma();

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true },
    });
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const companyName =
      (body.companyName ?? "").trim() || company.name || "General Clients";

    const dedupe = await checkOpportunityDuplicate({
      title,
      companyId: company.id,
    });
    if (dedupe.status === "DUPLICATE_EXISTS") {
      return NextResponse.json(
        {
          error: `An opportunity named "${dedupe.existingOpportunity.name}" already exists for this company.`,
          status: dedupe.status,
          existingOpportunity: dedupe.existingOpportunity,
        },
        { status: 409 },
      );
    }

    // 1. Create Opportunity in PostgreSQL first (fast path)
    const opportunity = await prisma.opportunity.create({
      data: {
        name: title,
        companyId: company.id,
        ownerId,
        value: typeof body.value === "number" ? body.value : null,
        stage: resolveStage(body.stage),
        currency: body.currency?.trim() || "USD",
        description: body.description?.trim() || null,
      },
    });

    await logAuditEvent({
      ...actor,
      action: "DEAL_CREATED",
      entityType: "Opportunity",
      entityId: opportunity.id,
      ipAddress: clientIpFromRequest(request),
      metadata: {
        name: opportunity.name,
        companyId: opportunity.companyId,
        stage: opportunity.stage,
      },
    });

    // 2. Provision SharePoint folder after response (non-blocking for the client)
    scheduleOpportunitySharePointFolderProvision({
      opportunityId: opportunity.id,
      companyName,
      opportunityTitle: title,
    });

    return NextResponse.json(
      { success: true, opportunity },
      { status: 201 },
    );
  } catch (error) {
    console.error("[api/opportunities] create failed", error);
    return NextResponse.json(
      {
        error: "Failed to create opportunity",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  try {
    const prisma = getPrisma();
    const url = new URL(request.url);
    const companyId = url.searchParams.get("companyId")?.trim();
    const take = Math.min(
      Number(url.searchParams.get("take") ?? "50") || 50,
      200,
    );

    const opportunities = await prisma.opportunity.findMany({
      where: companyId ? { companyId } : undefined,
      orderBy: { updatedAt: "desc" },
      take,
      include: {
        company: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(opportunities);
  } catch (error) {
    console.error("[api/opportunities] list failed", error);
    return NextResponse.json(
      {
        error: "Failed to list opportunities",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
