import { NextResponse } from "next/server";
import { getRequestRole } from "@/lib/api-auth";
import { canCreateOpportunity } from "@/lib/permissions";
import {
  clientIpFromRequest,
  logAuditEvent,
  resolveAuditActor,
} from "@/lib/security/audit-logger";
import {
  parsePageRequest,
  sharePointErrorResponse,
} from "@/services/sharepoint/server/api-utils";
import { SharePointServiceError } from "@/services/sharepoint/client/errors";
import { getServerSharePointServices } from "@/services/sharepoint/factory";
import type { CreateDealInput, CreateOpportunityInput } from "@/types/deal";

export async function GET(request: Request) {
  try {
    const { deals } = getServerSharePointServices();
    const page = parsePageRequest(request);
    const result = await deals.list(page);

    if (page.pageSize || page.skipToken) {
      return NextResponse.json(result);
    }

    return NextResponse.json(result.items);
  } catch (error) {
    return sharePointErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const role = getRequestRole(request);
  if (!canCreateOpportunity(role)) {
    return sharePointErrorResponse(
      SharePointServiceError.forbidden("Insufficient role to create opportunities"),
    );
  }

  try {
    const { deals } = getServerSharePointServices();
    const body = (await request.json()) as CreateDealInput | CreateOpportunityInput;
    const created = await deals.create(body);

    const actor = resolveAuditActor(request, role);
    await logAuditEvent({
      ...actor,
      action: "DEAL_CREATED",
      entityType: "Deal",
      entityId: created.id,
      ipAddress: clientIpFromRequest(request),
      metadata: {
        assetName: created.assetName,
        status: created.status,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return sharePointErrorResponse(error);
  }
}
