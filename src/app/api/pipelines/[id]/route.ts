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

/** Legacy alias — delegates to Deals SharePoint service with FS-013 audit. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json()) as UpdateDealInput;
  const role = getRequestRole(request);

  if (!canUpdateDealStage({ role })) {
    return sharePointErrorResponse(
      SharePointServiceError.forbidden("Insufficient role to update pipeline"),
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
      entityType: "Deal",
      entityId: id,
      ipAddress: clientIpFromRequest(request),
      metadata: {
        fields: Object.keys(body),
        source: "pipelines",
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
