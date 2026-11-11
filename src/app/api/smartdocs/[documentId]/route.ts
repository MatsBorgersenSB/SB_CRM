import { NextResponse } from "next/server";
import { resolveRequestRole } from "@/lib/api-auth";
import { canDeleteSmartDoc, canUploadSmartDocs } from "@/lib/permissions";
import { deleteSmartDoc } from "@/lib/smartdoc-delete";
import { patchSmartDocOptionalLinks } from "@/lib/smartdoc-optional-links";
import {
  clientIpFromRequest,
  logAuditEvent,
  resolveAuditActor,
} from "@/lib/security/audit-logger";
import { SharePointServiceError } from "@/services/sharepoint/client/errors";
import { sharePointErrorResponse } from "@/services/sharepoint/server/api-utils";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await params;
  const role = await resolveRequestRole(request);

  if (!canUploadSmartDocs(role) && role !== "admin") {
    return sharePointErrorResponse(
      SharePointServiceError.forbidden("Insufficient role to update document links"),
    );
  }

  const decoded = decodeURIComponent(documentId ?? "").trim();
  if (!decoded) {
    return NextResponse.json({ error: "Document id is required" }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    LinkedDealId?: string | null;
    LinkedProjectId?: string | null;
  };

  if (body.LinkedDealId === undefined && body.LinkedProjectId === undefined) {
    return NextResponse.json(
      { error: "LinkedDealId or LinkedProjectId is required" },
      { status: 400 },
    );
  }

  try {
    const document = await patchSmartDocOptionalLinks(decoded, {
      LinkedDealId: body.LinkedDealId,
      LinkedProjectId: body.LinkedProjectId,
    });

    const actor = resolveAuditActor(request, role);
    await logAuditEvent({
      ...actor,
      action: "SMARTDOC_LINKS_UPDATED",
      entityType: "SmartDoc",
      entityId: decoded,
      ipAddress: clientIpFromRequest(request),
      metadata: {
        LinkedDealId: body.LinkedDealId ?? null,
        LinkedProjectId: body.LinkedProjectId ?? null,
      },
    });

    return NextResponse.json({ document });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update links";
    if (/not found/i.test(message)) {
      return sharePointErrorResponse(
        SharePointServiceError.notFound("SmartDoc", decoded),
      );
    }
    if (/company-owned/i.test(message)) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return sharePointErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await params;
  const role = await resolveRequestRole(request);

  if (!canDeleteSmartDoc(role)) {
    return sharePointErrorResponse(
      SharePointServiceError.forbidden("Insufficient role to delete documents"),
    );
  }

  const decoded = decodeURIComponent(documentId ?? "").trim();
  if (!decoded) {
    return NextResponse.json({ error: "Document id is required" }, { status: 400 });
  }

  try {
    const deleted = await deleteSmartDoc(decoded);

    const actor = resolveAuditActor(request, role);
    await logAuditEvent({
      ...actor,
      action: "SMARTDOC_DELETED",
      entityType: "SmartDoc",
      entityId: deleted.documentId,
      ipAddress: clientIpFromRequest(request),
      metadata: {
        privileged: true,
        prismaDeleted: deleted.prismaDeleted,
        sharePointDeleted: deleted.sharePointDeleted,
        fileName: deleted.libraryRecord?.FileLeafRef,
      },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 404 || /not found/i.test(error instanceof Error ? error.message : "")) {
      return sharePointErrorResponse(
        SharePointServiceError.notFound("SmartDoc", decoded),
      );
    }
    return sharePointErrorResponse(error);
  }
}
