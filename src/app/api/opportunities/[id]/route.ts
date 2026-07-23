import { NextResponse } from "next/server";
import { getRequestRole } from "@/lib/api-auth";
import { assertPipelinePatchAllowed } from "@/lib/permissions";
import {
  clientIpFromRequest,
  logAuditEvent,
  resolveAuditActor,
} from "@/lib/security/audit-logger";
import { canUpdateDealStage } from "@/lib/security/rbac";
import { sharePointErrorResponse } from "@/services/sharepoint/server/api-utils";
import { SharePointServiceError } from "@/services/sharepoint/client/errors";
import { getServerSharePointServices } from "@/services/sharepoint/factory";
import type { UpdateDealInput } from "@/types/deal";

/**
 * FS-013 — Opportunity (deal) stage / field updates with RBAC + audit logging.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json()) as UpdateDealInput;
  const role = getRequestRole(request);

  if (!canUpdateDealStage({ role })) {
    return sharePointErrorResponse(
      SharePointServiceError.forbidden("Insufficient role to update opportunity"),
    );
  }

  try {
    assertPipelinePatchAllowed(role, body);
    const { deals } = getServerSharePointServices();
    const before = await deals.getById(id).catch(() => null);
    const updated = await deals.update(id, body);

    const actor = resolveAuditActor(request, role);
    const stageChanged =
      body.status !== undefined && before?.status !== updated.status;

    await logAuditEvent({
      ...actor,
      action: stageChanged ? "STAGE_CHANGED" : "DEAL_UPDATED",
      entityType: "Opportunity",
      entityId: id,
      ipAddress: clientIpFromRequest(request),
      metadata: {
        fields: Object.keys(body),
        ...(stageChanged
          ? { previousStatus: before?.status ?? null, newStatus: updated.status }
          : {}),
      },
    });

    return NextResponse.json({
      ...updated,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    return sharePointErrorResponse(error);
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const { deals } = getServerSharePointServices();
    const deal = await deals.getById(id);
    return NextResponse.json(deal);
  } catch (error) {
    return sharePointErrorResponse(error);
  }
}
