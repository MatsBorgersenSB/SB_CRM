import { NextResponse } from "next/server";
import { getRequestRole } from "@/lib/api-auth";
import { assertPipelinePatchAllowed } from "@/lib/permissions";
import {
  clientIpFromRequest,
  logAuditEvent,
  resolveAuditActor,
} from "@/lib/security/audit-logger";
import { canUpdateDealStage } from "@/lib/security/rbac";
import { projectWonGateResponse } from "@/lib/project-won-gate";
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
  const { stageReason: rawReason, ...body } = (await request.json()) as UpdateDealInput & {
    stageReason?: string;
  };
  const stageReason =
    typeof rawReason === "string" ? rawReason.trim().slice(0, 500) || null : null;
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
    const blocked = projectWonGateResponse(before, body);
    if (blocked) return blocked;
    const updated = await deals.update(id, body);

    const actor = resolveAuditActor(request, role);
    const stageChanged =
      (body.salesStageId !== undefined &&
        before?.salesStageId !== updated.salesStageId) ||
      (body.status !== undefined && before?.status !== updated.status);

    await logAuditEvent({
      ...actor,
      action: stageChanged ? "STAGE_CHANGED" : "DEAL_UPDATED",
      entityType: "Opportunity",
      entityId: id,
      ipAddress: clientIpFromRequest(request),
      metadata: {
        fields: Object.keys(body),
        ...(stageChanged
          ? {
              previousStatus: before?.status ?? null,
              newStatus: updated.status,
              previousStage: before?.salesStageId ?? null,
              newStage: updated.salesStageId ?? null,
              ...(stageReason ? { reason: stageReason } : {}),
            }
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
